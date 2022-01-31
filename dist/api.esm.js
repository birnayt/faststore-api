import { makeExecutableSchema } from '@graphql-tools/schema';
import fetch from 'isomorphic-unfetch';
import DataLoader from 'dataloader';
import rawSlugify from '@sindresorhus/slugify';
import deepEquals from 'fast-deep-equal';
import { print } from 'graphql';

const fetchAPI = async (info, init) => {
  const response = await fetch(info, init);

  if (response.ok) {
    return response.json();
  }

  const text = await response.text();
  throw new Error(text);
};

const BASE_INIT = {
  method: 'POST',
  headers: {
    'content-type': 'application/json'
  }
};
const VtexCommerce = ({
  account,
  environment
}, ctx) => {
  const base = `http://${account}.${environment}.com.br`;
  return {
    catalog: {
      brand: {
        list: () => fetchAPI(`${base}/api/catalog_system/pub/brand/list`)
      },
      category: {
        tree: (depth = 3) => fetchAPI(`${base}/api/catalog_system/pub/category/tree/${depth}`)
      },
      portal: {
        pagetype: slug => fetchAPI(`${base}/api/catalog_system/pub/portal/pagetype/${slug}`)
      }
    },
    checkout: {
      simulation: (args, {
        salesChannel
      } = {
        salesChannel: ctx.storage.channel
      }) => {
        const params = new URLSearchParams({
          sc: salesChannel
        });
        return fetchAPI(`${base}/api/checkout/pub/orderForms/simulation?${params.toString()}`, { ...BASE_INIT,
          body: JSON.stringify(args)
        });
      },
      orderForm: ({
        id,
        refreshOutdatedData = true,
        salesChannel = ctx.storage.channel
      }) => {
        const params = new URLSearchParams({
          refreshOutdatedData: refreshOutdatedData.toString(),
          sc: salesChannel
        });
        return fetchAPI(`${base}/api/checkout/pub/orderForm/${id}?${params.toString()}`, BASE_INIT);
      },
      updateOrderFormItems: ({
        id,
        orderItems,
        allowOutdatedData = 'paymentData',
        salesChannel = ctx.storage.channel
      }) => {
        const params = new URLSearchParams({
          allowOutdatedData,
          sc: salesChannel
        });
        return fetchAPI(`${base}/api/checkout/pub/orderForm/${id}/items?${params}`, { ...BASE_INIT,
          body: JSON.stringify({
            orderItems
          }),
          method: 'PATCH'
        });
      }
    }
  };
};

const IntelligentSearch = ({
  account,
  environment
}, ctx) => {
  const base = `http://portal.${environment}.com.br/search-api/v1/${account}`;
  const policyFacet = {
    key: 'trade-policy',
    value: ctx.storage.channel
  };

  const addDefaultFacets = facets => {
    const facet = facets.find(({
      key
    }) => key === policyFacet.key);

    if (facet === undefined) {
      return [...facets, policyFacet];
    }

    return facets;
  };

  const search = ({
    query = '',
    page,
    count,
    sort = '',
    selectedFacets = [],
    type,
    fuzzy = '0'
  }) => {
    const params = new URLSearchParams({
      page: (page + 1).toString(),
      count: count.toString(),
      query,
      sort,
      fuzzy
    });
    const pathname = addDefaultFacets(selectedFacets).map(({
      key,
      value
    }) => `${key}/${value}`).join('/');
    return fetchAPI(`${base}/api/split/${type}/${pathname}?${params.toString()}`);
  };

  const products = args => search({ ...args,
    type: 'product_search'
  });

  const facets = args => search({ ...args,
    type: 'attribute_search'
  });

  return {
    facets,
    products
  };
};

const getClients = (options, ctx) => {
  const search = IntelligentSearch(options, ctx);
  const commerce = VtexCommerce(options, ctx);
  return {
    search,
    commerce
  };
};

const getSimulationLoader = (_, clients) => {
  const loader = async allItems => {
    const items = [...allItems.flat()];
    const simulation = await clients.commerce.checkout.simulation({
      items
    }); // Sort and filter simulation since Checkout API may return
    // items that we didn't ask for

    const simulated = simulation.items.reduce((acc, item) => {
      const index = item.requestIndex;

      if (typeof index === 'number' && index < acc.length) {
        acc[index] = item;
      }

      return acc;
    }, Array(items.length).fill(null));
    const itemsIndices = allItems.reduce((acc, curr) => [...acc, curr.length + acc[acc.length - 1]], [0]);
    return allItems.map((__, index) => ({ ...simulation,
      items: simulated.slice(itemsIndices[index], itemsIndices[index + 1]).filter(item => Boolean(item))
    }));
  };

  return new DataLoader(loader, {
    maxBatchSize: 20
  });
};

class BadRequestError extends Error {
  constructor(message) {
    super(message);
    this.name = 'BadRequestError';
  }

}
class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotFoundError';
  }

}

const enhanceSku = (sku, product) => ({ ...sku,
  isVariantOf: product
});

const getSkuLoader = (_, clients) => {
  const loader = async facetsList => {
    const skuIds = facetsList.map(facets => {
      const maybeFacet = facets.find(({
        key
      }) => key === 'id');

      if (!maybeFacet) {
        throw new BadRequestError('Error while loading SKU. Needs to pass an id to selected facets');
      }

      return maybeFacet.value;
    });
    const {
      products
    } = await clients.search.products({
      query: `sku:${skuIds.join(';')}`,
      page: 0,
      count: skuIds.length
    });
    const skuBySkuId = products.reduce((acc, product) => {
      for (const sku of product.skus) {
        acc[sku.id] = enhanceSku(sku, product);
      }

      return acc;
    }, {});
    const skus = skuIds.map(skuId => skuBySkuId[skuId]);
    const missingSkus = skus.filter(sku => !sku);

    if (missingSkus.length > 0) {
      throw new Error(`Search API did not return the following skus: ${missingSkus.join(',')}`);
    }

    return skus;
  };

  return new DataLoader(loader, {
    maxBatchSize: 99
  });
};

const getLoaders = (options, {
  clients
}) => {
  const skuLoader = getSkuLoader(options, clients);
  const simulationLoader = getSimulationLoader(options, clients);
  return {
    skuLoader,
    simulationLoader
  };
};

const StoreAggregateOffer = {
  highPrice: ({
    items
  }) => {
    var _items$0$sellingPrice, _items$;

    return items.reduce((acc, curr) => acc > curr.sellingPrice ? acc : curr.sellingPrice, (_items$0$sellingPrice = (_items$ = items[0]) == null ? void 0 : _items$.sellingPrice) != null ? _items$0$sellingPrice : 0) / 1e2;
  },
  lowPrice: ({
    items
  }) => {
    var _items$0$sellingPrice2, _items$2;

    return items.reduce((acc, curr) => acc < curr.sellingPrice ? acc : curr.sellingPrice, (_items$0$sellingPrice2 = (_items$2 = items[0]) == null ? void 0 : _items$2.sellingPrice) != null ? _items$0$sellingPrice2 : 0) / 1e2;
  },
  offerCount: ({
    items
  }) => items.length,
  priceCurrency: () => '',
  offers: ({
    items,
    product
  }) => items.map(item => ({ ...item,
    product
  }))
};

// TODO: Add a review system integration
const StoreAggregateRating = {
  ratingValue: () => 5,
  reviewCount: () => 0
};

const slugify = path => rawSlugify(path, {
  separator: '-',
  lowercase: true
});

const isBrand = x => x.type === 'brand';

const isPortalPageType = x => typeof x.pageType === 'string';

const slugify$1 = root => {
  if (isBrand(root)) {
    return slugify(root.name);
  }

  if (isPortalPageType(root)) {
    return new URL(`https://${root.url}`).pathname.slice(1);
  }

  return new URL(root.url).pathname.slice(1);
};

const StoreCollection = {
  id: ({
    id
  }) => id.toString(),
  slug: root => slugify$1(root),
  seo: root => isBrand(root) || isPortalPageType(root) ? {
    title: root.title,
    description: root.metaTagDescription
  } : {
    title: root.Title,
    description: root.MetaTagDescription
  },
  type: root => isBrand(root) ? 'Brand' : isPortalPageType(root) ? root.pageType : root.level === 0 ? 'Department' : 'Category',
  meta: root => isBrand(root) ? {
    selectedFacets: [{
      key: 'brand',
      value: slugify(root.name)
    }]
  } : {
    selectedFacets: new URL(isPortalPageType(root) ? `https://${root.url}` : root.url).pathname.slice(1).split('/').map((segment, index) => ({
      key: `category-${index + 1}`,
      value: slugify(segment)
    }))
  },
  breadcrumbList: async (root, _, ctx) => {
    const {
      clients: {
        commerce
      }
    } = ctx;
    const slug = slugify$1(root);
    /**
     * Split slug into segments so we fetch all data for
     * the breadcrumb. For instance, if we get `/foo/bar`
     * we need all metadata for both `/foo` and `/bar` and
     * thus we need to fetch pageType for `/foo` and `/bar`
     */

    const segments = slug.split('/').filter(segment => Boolean(segment));
    const slugs = segments.map((__, index) => segments.slice(0, index + 1).join('/'));
    const pageTypes = await Promise.all(slugs.map(s => commerce.catalog.portal.pagetype(s)));
    return {
      itemListElement: pageTypes.map((pageType, index) => ({
        item: new URL(`https://${pageType.url}`).pathname,
        name: pageType.name,
        position: index + 1
      })),
      numberOfItems: pageTypes.length
    };
  }
};

const StoreFacet = {
  key: ({
    key
  }) => key,
  label: ({
    label
  }) => label,
  values: ({
    values
  }) => values,
  type: ({
    type
  }) => type === 'text' ? 'BOOLEAN' : 'RANGE'
};

const StoreFacetValue = {
  value: ({
    key,
    from,
    to
  }) => key != null ? key : `${from}-to-${to}`,
  label: ({
    label
  }) => label != null ? label : 'unknown',
  selected: ({
    active
  }) => active,
  quantity: ({
    count
  }) => count
};

const getId = item => [item.itemOffered.sku, item.seller.identifier, item.price].join('::');

const orderFormItemToOffer = (item, index) => ({
  listPrice: item.listPrice / 100,
  price: item.sellingPrice / 100,
  quantity: item.quantity,
  seller: {
    identifier: item.seller
  },
  itemOffered: {
    sku: item.id,
    image: [],
    name: item.name
  },
  index
});

const offerToOrderItemInput = offer => ({
  quantity: offer.quantity,
  seller: offer.seller.identifier,
  id: offer.itemOffered.sku,
  index: offer.index
});

const groupById = offers => offers.reduce((acc, item) => {
  var _acc$get;

  const id = getId(item);
  acc.set(id, (_acc$get = acc.get(id)) != null ? _acc$get : item);
  return acc;
}, new Map());

const equals = (of1, of2) => {
  const pick = ({
    orderFormId,
    messages,
    items,
    salesChannel
  }) => ({
    orderFormId,
    messages,
    salesChannel,
    items: items.map(({
      uniqueId,
      quantity,
      seller,
      sellingPrice,
      availability
    }) => ({
      uniqueId,
      quantity,
      seller,
      sellingPrice,
      availability
    }))
  });

  return deepEquals(pick(of1), pick(of2));
};
/**
 * This resolver implements the optimistic cart behavior. The main idea in here
 * is that we receive a cart from the UI (as query params) and we validate it with
 * the commerce platform. If the cart is valid, we return null, if the cart is
 * invalid according to the commerce platform, we return the new cart the UI should use
 * instead
 *
 * The algoritm is something like:
 * 1. Fetch orderForm from VTEX
 * 2. Compute delta changes between the orderForm and the UI's cart
 * 3. Update the orderForm in VTEX platform accordingly
 * 4. If any chages were made, send to the UI the new cart. Null otherwise
 */


const validateCart = async (_, {
  cart: {
    order: {
      orderNumber,
      acceptedOffer
    }
  }
}, ctx) => {
  const {
    clients: {
      commerce
    },
    loaders: {
      skuLoader
    }
  } = ctx; // Step1: Get OrderForm from VTEX Commerce

  const orderForm = await commerce.checkout.orderForm({
    id: orderNumber
  });
  console.log(orderForm, 'orderForm'); // Step2: Process items from both browser and checkout so they have the same shape

  const browserItemsById = groupById(acceptedOffer);
  const originItemsById = groupById(orderForm.items.map(orderFormItemToOffer));
  const browserItems = Array.from(browserItemsById.values()); // items on the user's browser

  const originItems = Array.from(originItemsById.values()); // items on the VTEX platform backend
  // Step3: Compute delta changes

  const {
    itemsToAdd,
    itemsToUpdate
  } = browserItems.reduce((acc, item) => {
    const maybeOriginItem = originItemsById.get(getId(item));

    if (!maybeOriginItem) {
      acc.itemsToAdd.push(item);
    } else {
      acc.itemsToUpdate.push({ ...maybeOriginItem,
        quantity: item.quantity
      });
    }

    return acc;
  }, {
    itemsToAdd: [],
    itemsToUpdate: []
  });
  const itemsToDelete = originItems.filter(item => !browserItemsById.has(getId(item))).map(item => ({ ...item,
    quantity: 0
  }));
  const changes = [...itemsToAdd, ...itemsToUpdate, ...itemsToDelete].map(offerToOrderItemInput);

  if (changes.length === 0) {
    return null;
  } // Step4: Apply delta changes to order form


  const updatedOrderForm = await commerce.checkout.updateOrderFormItems({
    id: orderForm.orderFormId,
    orderItems: changes
  }); // Step5: If no changes detected before/after updating orderForm, the order is validated

  if (equals(orderForm, updatedOrderForm)) {
    return null;
  } // Step6: There were changes, convert orderForm to StoreOrder


  return {
    order: {
      orderNumber: updatedOrderForm.orderFormId,
      acceptedOffer: updatedOrderForm.items.map(item => ({ ...item,
        product: skuLoader.load([{
          key: 'id',
          value: item.id
        }])
      }))
    },
    messages: updatedOrderForm.messages.map(({
      text,
      status
    }) => ({
      text,
      status: status.toUpperCase()
    }))
  };
};

const Mutation = {
  validateCart
};

const StoreOffer = {
  priceCurrency: () => '',
  priceValidUntil: ({
    priceValidUntil
  }) => priceValidUntil != null ? priceValidUntil : '',
  itemCondition: () => 'https://schema.org/NewCondition',
  availability: ({
    availability
  }) => availability === 'available' ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
  seller: ({
    seller
  }) => ({
    identifier: seller
  }),
  price: ({
    sellingPrice
  }) => sellingPrice / 1e2,
  sellingPrice: ({
    sellingPrice
  }) => sellingPrice / 1e2,
  listPrice: ({
    listPrice
  }) => listPrice / 1e2,
  itemOffered: ({
    product
  }) => product,
  quantity: ({
    quantity
  }) => quantity
};

const DEFAULT_IMAGE = {
  name: 'image',
  value: 'https://storecomponents.vtexassets.com/assets/faststore/images/image___117a6d3e229a96ad0e0d0876352566e2.svg'
};

const getSlug = (link, id) => `${link}-${id}`;

const getPath = (link, id) => `/${getSlug(link, id)}/p`;

const nonEmptyArray = array => Array.isArray(array) && array.length > 0 ? array : null;

const StoreProduct = {
  productID: ({
    id
  }) => id,
  name: ({
    isVariantOf,
    name
  }) => name != null ? name : isVariantOf.name,
  slug: ({
    isVariantOf: {
      link
    },
    id
  }) => getSlug(link, id),
  description: ({
    isVariantOf: {
      description
    }
  }) => description,
  seo: ({
    isVariantOf: {
      name,
      description
    }
  }) => ({
    title: name,
    description
  }),
  brand: ({
    isVariantOf: {
      brand
    }
  }) => ({
    name: brand
  }),
  breadcrumbList: ({
    isVariantOf: {
      categoryTrees,
      name,
      link
    },
    id
  }) => ({
    itemListElement: [...categoryTrees.reverse().map(({
      categoryNames
    }, index) => ({
      name: categoryNames[categoryNames.length - 1],
      item: `/${categoryNames.join('/').toLowerCase()}`,
      position: index + 1
    })), {
      name,
      item: getPath(link, id),
      position: categoryTrees.length + 1
    }],
    numberOfItems: categoryTrees.length
  }),
  image: ({
    isVariantOf,
    images
  }) => {
    var _ref, _nonEmptyArray;

    return ((_ref = (_nonEmptyArray = nonEmptyArray(images)) != null ? _nonEmptyArray : nonEmptyArray(isVariantOf.images)) != null ? _ref : [DEFAULT_IMAGE]).map(({
      name,
      value
    }) => ({
      alternateName: name != null ? name : '',
      url: value.replace('vteximg.com.br', 'vtexassets.com')
    }));
  },
  sku: ({
    isVariantOf: {
      skus: [sku]
    }
  }) => sku.id,
  gtin: ({
    reference
  }) => reference != null ? reference : '',
  review: () => [],
  aggregateRating: () => ({}),
  offers: async (product, _, ctx) => {
    var _policies$find;

    const {
      loaders: {
        simulationLoader
      },
      storage: {
        channel
      }
    } = ctx;
    const {
      id,
      policies
    } = product;
    const sellers = (_policies$find = policies.find(policy => policy.id === channel)) == null ? void 0 : _policies$find.sellers;

    if (sellers == null) {
      // This error will likely happen when you forget to forward the channel somewhere in your code.
      // Make sure all queries that lead to a product are forwarding the channel in context corectly
      throw new Error(`Product with id ${id} has no sellers for channel ${channel}.`);
    } // Unique seller ids


    const sellerIds = sellers.map(seller => seller.id);
    const items = Array.from(new Set(sellerIds)).map(seller => ({
      quantity: 1,
      seller,
      id
    }));
    const simulation = await simulationLoader.load(items);
    return { ...simulation,
      product
    };
  },
  isVariantOf: ({
    isVariantOf
  }) => isVariantOf
};

const StoreProductGroup = {
  hasVariant: root => root.skus.map(sku => enhanceSku(sku, root)),
  productGroupID: ({
    product
  }) => product,
  name: ({
    name
  }) => name
};

const getIdFromSlug = slug => {
  const id = slug.split('-').pop();

  if (id == null) {
    throw new BadRequestError('Error while extracting sku id from product slug');
  }

  return id;
};
/**
 * Transform facets from the store to VTEX platform facets.
 * For instance, the channel in Store becames trade-policy in VTEX's realm
 * */


const transformSelectedFacet = ({
  key,
  value
}) => {
  switch (key) {
    case 'channel':
      return {
        key: 'trade-policy',
        value
      };

    case 'slug':
      return {
        key: 'id',
        value: getIdFromSlug(value)
      };

    default:
      return {
        key,
        value
      };
  }
};

const SORT_MAP = {
  price_desc: 'price:desc',
  price_asc: 'price:asc',
  orders_desc: 'orders:desc',
  name_desc: 'name:desc',
  name_asc: 'name:asc',
  release_desc: 'release:desc',
  discount_desc: 'discount:desc',
  score_desc: ''
};

const Query = {
  product: async (_, {
    locator
  }, ctx) => {
    var _locator$find$value, _locator$find;

    // Insert channel in context for later usage
    ctx.storage = { ...ctx.storage,
      channel: (_locator$find$value = (_locator$find = locator.find(facet => facet.key === 'channel')) == null ? void 0 : _locator$find.value) != null ? _locator$find$value : ctx.storage.channel
    };
    const {
      loaders: {
        skuLoader
      }
    } = ctx;
    return skuLoader.load(locator.map(transformSelectedFacet));
  },
  collection: async (_, {
    slug
  }, ctx) => {
    const {
      clients: {
        commerce
      }
    } = ctx;
    const result = await commerce.catalog.portal.pagetype(slug);
    const whitelist = ['Brand', 'Category', 'Department', 'Subcategory'];

    if (whitelist.includes(result.pageType)) {
      return result;
    }

    throw new NotFoundError(`Not Found: ${slug}`);
  },
  search: async (_, {
    first,
    after: maybeAfter,
    sort,
    term,
    selectedFacets
  }, ctx) => {
    var _selectedFacets$find$, _selectedFacets$find, _selectedFacets$map;

    // Insert channel in context for later usage
    ctx.storage = { ...ctx.storage,
      channel: (_selectedFacets$find$ = selectedFacets == null ? void 0 : (_selectedFacets$find = selectedFacets.find(facet => facet.key === 'channel')) == null ? void 0 : _selectedFacets$find.value) != null ? _selectedFacets$find$ : ctx.storage.channel
    };
    const after = maybeAfter ? Number(maybeAfter) : 0;
    const searchArgs = {
      page: Math.ceil(after / first),
      count: first,
      query: term,
      sort: SORT_MAP[sort != null ? sort : 'score_desc'],
      selectedFacets: (_selectedFacets$map = selectedFacets == null ? void 0 : selectedFacets.map(transformSelectedFacet)) != null ? _selectedFacets$map : []
    };
    return searchArgs;
  },
  allProducts: async (_, {
    first,
    after: maybeAfter
  }, ctx) => {
    const {
      clients: {
        search
      }
    } = ctx;
    const after = maybeAfter ? Number(maybeAfter) : 0;
    const products = await search.products({
      page: Math.ceil(after / first),
      count: first
    });
    const skus = products.products.map(product => product.skus.map(sku => enhanceSku(sku, product))).flat().filter(sku => sku.sellers.length > 0);
    return {
      pageInfo: {
        hasNextPage: products.pagination.after.length > 0,
        hasPreviousPage: products.pagination.before.length > 0,
        startCursor: '0',
        endCursor: products.total.toString(),
        totalCount: products.total
      },
      edges: skus.map((sku, index) => ({
        node: sku,
        cursor: (after + index).toString()
      }))
    };
  },
  allCollections: async (_, __, ctx) => {
    const {
      clients: {
        commerce
      }
    } = ctx;
    const [brands, tree] = await Promise.all([commerce.catalog.brand.list(), commerce.catalog.category.tree()]);
    const categories = [];

    const dfs = (node, level) => {
      categories.push({ ...node,
        level
      });

      for (const child of node.children) {
        dfs(child, level + 1);
      }
    };

    for (const node of tree) {
      dfs(node, 0);
    }

    const collections = [...brands.map(x => ({ ...x,
      type: 'brand'
    })), ...categories];
    return {
      pageInfo: {
        hasNextPage: false,
        hasPreviousPage: false,
        startCursor: '0',
        endCursor: '0'
      },
      edges: collections // Nullable slugs may cause one route to override the other
      .filter(node => Boolean(StoreCollection.slug(node, null, ctx, null))).map((node, index) => ({
        node,
        cursor: index.toString()
      }))
    };
  }
};

const StoreReview = {
  reviewRating: () => ({
    ratingValue: 5,
    bestRating: 5
  }),
  author: () => ({
    name: ''
  })
};

const StoreSearchResult = {
  products: async (searchArgs, _, ctx) => {
    const {
      clients: {
        search
      }
    } = ctx;
    const products = await search.products(searchArgs);
    const skus = products.products.map(product => {
      const maybeSku = product.skus.find(x => x.sellers.length > 0);
      return maybeSku && enhanceSku(maybeSku, product);
    }).filter(sku => !!sku);
    return {
      pageInfo: {
        hasNextPage: products.pagination.after.length > 0,
        hasPreviousPage: products.pagination.before.length > 0,
        startCursor: '0',
        endCursor: products.total.toString(),
        totalCount: products.total
      },
      edges: skus.map((sku, index) => ({
        node: sku,
        cursor: index.toString()
      }))
    };
  },
  facets: async (searchArgs, _, ctx) => {
    var _facets$attributes;

    const {
      clients: {
        search: is
      }
    } = ctx;
    const facets = await is.facets(searchArgs);
    return (_facets$attributes = facets.attributes) != null ? _facets$attributes : [];
  }
};

const StoreSeo = {
  title: ({
    title
  }) => title != null ? title : '',
  description: ({
    description
  }) => description != null ? description : '',
  titleTemplate: () => '',
  canonical: () => ''
};

const Resolvers = {
  StoreCollection,
  StoreAggregateOffer,
  StoreProduct,
  StoreSeo,
  StoreFacet,
  StoreFacetValue,
  StoreOffer,
  StoreAggregateRating,
  StoreReview,
  StoreProductGroup,
  StoreSearchResult,
  Query,
  Mutation
};
const getContextFactory = options => ctx => {
  ctx.storage = {
    channel: options.channel
  };
  ctx.clients = getClients(options, ctx);
  ctx.loaders = getLoaders(options, ctx);
  return ctx;
};
const getResolvers = _ => Resolvers;

var doc = {"kind":"Document","definitions":[{"kind":"ObjectTypeDefinition","name":{"kind":"Name","value":"StoreAggregateOffer"},"interfaces":[],"directives":[],"fields":[{"kind":"FieldDefinition","name":{"kind":"Name","value":"highPrice"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Float"}}},"directives":[]},{"kind":"FieldDefinition","name":{"kind":"Name","value":"lowPrice"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Float"}}},"directives":[]},{"kind":"FieldDefinition","name":{"kind":"Name","value":"offerCount"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},"directives":[]},{"kind":"FieldDefinition","name":{"kind":"Name","value":"priceCurrency"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},"directives":[]},{"kind":"FieldDefinition","name":{"kind":"Name","value":"offers"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"StoreOffer"}}}}},"directives":[]}]}],"loc":{"start":0,"end":261}};
    doc.loc.source = {"body":"type StoreAggregateOffer {\n  # Highest spot price amongst all sellers\n  highPrice: Float!\n  # Lowest spot price amongst all sellers\n  lowPrice: Float!\n  # Number of sellers selling this sku\n  offerCount: Int!\n  priceCurrency: String!\n  offers: [StoreOffer!]!\n}\n","name":"GraphQL request","locationOffset":{"line":1,"column":1}};

var doc$1 = {"kind":"Document","definitions":[{"kind":"ObjectTypeDefinition","name":{"kind":"Name","value":"StoreAggregateRating"},"interfaces":[],"directives":[],"fields":[{"kind":"FieldDefinition","name":{"kind":"Name","value":"ratingValue"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Float"}}},"directives":[]},{"kind":"FieldDefinition","name":{"kind":"Name","value":"reviewCount"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},"directives":[]}]}],"loc":{"start":0,"end":72}};
    doc$1.loc.source = {"body":"type StoreAggregateRating {\n  ratingValue: Float!\n  reviewCount: Int!\n}\n","name":"GraphQL request","locationOffset":{"line":1,"column":1}};

var doc$2 = {"kind":"Document","definitions":[{"kind":"ObjectTypeDefinition","name":{"kind":"Name","value":"StoreAuthor"},"interfaces":[],"directives":[],"fields":[{"kind":"FieldDefinition","name":{"kind":"Name","value":"name"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},"directives":[]}]}],"loc":{"start":0,"end":37}};
    doc$2.loc.source = {"body":"type StoreAuthor {\n  name: String!\n}\n","name":"GraphQL request","locationOffset":{"line":1,"column":1}};

var doc$3 = {"kind":"Document","definitions":[{"kind":"ObjectTypeDefinition","name":{"kind":"Name","value":"StoreBrand"},"interfaces":[],"directives":[],"fields":[{"kind":"FieldDefinition","name":{"kind":"Name","value":"name"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},"directives":[]}]}],"loc":{"start":0,"end":36}};
    doc$3.loc.source = {"body":"type StoreBrand {\n  name: String!\n}\n","name":"GraphQL request","locationOffset":{"line":1,"column":1}};

var doc$4 = {"kind":"Document","definitions":[{"kind":"ObjectTypeDefinition","name":{"kind":"Name","value":"StoreListItem"},"interfaces":[],"directives":[],"fields":[{"kind":"FieldDefinition","name":{"kind":"Name","value":"item"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},"directives":[]},{"kind":"FieldDefinition","name":{"kind":"Name","value":"name"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},"directives":[]},{"kind":"FieldDefinition","name":{"kind":"Name","value":"position"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},"directives":[]}]},{"kind":"ObjectTypeDefinition","name":{"kind":"Name","value":"StoreBreadcrumbList"},"interfaces":[],"directives":[],"fields":[{"kind":"FieldDefinition","name":{"kind":"Name","value":"itemListElement"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"StoreListItem"}}}}},"directives":[]},{"kind":"FieldDefinition","name":{"kind":"Name","value":"numberOfItems"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},"directives":[]}]}],"loc":{"start":0,"end":161}};
    doc$4.loc.source = {"body":"type StoreListItem {\n  item: String!\n  name: String!\n  position: Int!\n}\n\ntype StoreBreadcrumbList {\n  itemListElement: [StoreListItem!]!\n  numberOfItems: Int!\n}\n","name":"GraphQL request","locationOffset":{"line":1,"column":1}};

var doc$5 = {"kind":"Document","definitions":[{"kind":"EnumTypeDefinition","name":{"kind":"Name","value":"StoreCollectionType"},"directives":[],"values":[{"kind":"EnumValueDefinition","name":{"kind":"Name","value":"Department"},"directives":[]},{"kind":"EnumValueDefinition","name":{"kind":"Name","value":"Category"},"directives":[]},{"kind":"EnumValueDefinition","name":{"kind":"Name","value":"Brand"},"directives":[]},{"kind":"EnumValueDefinition","name":{"kind":"Name","value":"Cluster"},"directives":[]}]},{"kind":"ObjectTypeDefinition","name":{"kind":"Name","value":"StoreCollectionFacet"},"interfaces":[],"directives":[],"fields":[{"kind":"FieldDefinition","name":{"kind":"Name","value":"key"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},"directives":[]},{"kind":"FieldDefinition","name":{"kind":"Name","value":"value"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},"directives":[]}]},{"kind":"ObjectTypeDefinition","name":{"kind":"Name","value":"StoreCollectionMeta"},"interfaces":[],"directives":[],"fields":[{"kind":"FieldDefinition","name":{"kind":"Name","value":"selectedFacets"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"StoreCollectionFacet"}}}}},"directives":[]}]},{"kind":"ObjectTypeDefinition","name":{"kind":"Name","value":"StoreCollection"},"interfaces":[],"directives":[],"fields":[{"kind":"FieldDefinition","name":{"kind":"Name","value":"seo"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"StoreSeo"}}},"directives":[]},{"kind":"FieldDefinition","name":{"kind":"Name","value":"breadcrumbList"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"StoreBreadcrumbList"}}},"directives":[]},{"kind":"FieldDefinition","name":{"kind":"Name","value":"meta"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"StoreCollectionMeta"}}},"directives":[]},{"kind":"FieldDefinition","name":{"kind":"Name","value":"id"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}},"directives":[]},{"kind":"FieldDefinition","name":{"kind":"Name","value":"slug"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},"directives":[]},{"kind":"FieldDefinition","name":{"kind":"Name","value":"type"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"StoreCollectionType"}}},"directives":[]}]}],"loc":{"start":0,"end":424}};
    doc$5.loc.source = {"body":"enum StoreCollectionType {\n  Department\n  Category\n  Brand\n  Cluster\n}\n\ntype StoreCollectionFacet {\n  key: String!\n  value: String!\n}\n\ntype StoreCollectionMeta {\n  selectedFacets: [StoreCollectionFacet!]!\n}\n\ntype StoreCollection {\n  # Meta tag data\n  seo: StoreSeo!\n  # location for structured data\n  breadcrumbList: StoreBreadcrumbList!\n  meta: StoreCollectionMeta!\n  id: ID!\n  slug: String!\n  type: StoreCollectionType!\n}\n","name":"GraphQL request","locationOffset":{"line":1,"column":1}};

var doc$6 = {"kind":"Document","definitions":[{"kind":"ObjectTypeDefinition","name":{"kind":"Name","value":"StoreFacet"},"interfaces":[],"directives":[],"fields":[{"kind":"FieldDefinition","name":{"kind":"Name","value":"key"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},"directives":[]},{"kind":"FieldDefinition","name":{"kind":"Name","value":"label"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},"directives":[]},{"kind":"FieldDefinition","name":{"kind":"Name","value":"values"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"StoreFacetValue"}}}}},"directives":[]},{"kind":"FieldDefinition","name":{"kind":"Name","value":"type"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"StoreFacetType"}}},"directives":[]}]},{"kind":"ObjectTypeDefinition","name":{"kind":"Name","value":"StoreFacetValue"},"interfaces":[],"directives":[],"fields":[{"kind":"FieldDefinition","name":{"kind":"Name","value":"value"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},"directives":[]},{"kind":"FieldDefinition","name":{"kind":"Name","value":"label"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},"directives":[]},{"kind":"FieldDefinition","name":{"kind":"Name","value":"selected"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}},"directives":[]},{"kind":"FieldDefinition","name":{"kind":"Name","value":"quantity"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},"directives":[]}]}],"loc":{"start":0,"end":240}};
    doc$6.loc.source = {"body":"type StoreFacet {\n  key: String!\n  label: String!\n  values: [StoreFacetValue!]!\n  type: StoreFacetType!\n}\n\ntype StoreFacetValue {\n  value: String!\n  label: String!\n  selected: Boolean!\n  # Number of items with this facet\n  quantity: Int!\n}\n","name":"GraphQL request","locationOffset":{"line":1,"column":1}};

var doc$7 = {"kind":"Document","definitions":[{"kind":"ObjectTypeDefinition","name":{"kind":"Name","value":"StoreImage"},"interfaces":[],"directives":[],"fields":[{"kind":"FieldDefinition","name":{"kind":"Name","value":"url"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},"directives":[]},{"kind":"FieldDefinition","name":{"kind":"Name","value":"alternateName"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},"directives":[]}]},{"kind":"InputObjectTypeDefinition","name":{"kind":"Name","value":"IStoreImage"},"directives":[],"fields":[{"kind":"InputValueDefinition","name":{"kind":"Name","value":"url"},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},"directives":[]},{"kind":"InputValueDefinition","name":{"kind":"Name","value":"alternateName"},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},"directives":[]}]}],"loc":{"start":0,"end":123}};
    doc$7.loc.source = {"body":"type StoreImage {\n  url: String!\n  alternateName: String!\n}\n\ninput IStoreImage {\n  url: String!\n  alternateName: String!\n}\n","name":"GraphQL request","locationOffset":{"line":1,"column":1}};

var doc$8 = {"kind":"Document","definitions":[{"kind":"ObjectTypeDefinition","name":{"kind":"Name","value":"Mutation"},"interfaces":[],"directives":[],"fields":[{"kind":"FieldDefinition","name":{"kind":"Name","value":"validateCart"},"arguments":[{"kind":"InputValueDefinition","name":{"kind":"Name","value":"cart"},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"IStoreCart"}}},"directives":[]}],"type":{"kind":"NamedType","name":{"kind":"Name","value":"StoreCart"}},"directives":[]}]}],"loc":{"start":0,"end":148}};
    doc$8.loc.source = {"body":"type Mutation {\n  # Returns the order if anything changed with the order. Null if the order is valid\n  validateCart(cart: IStoreCart!): StoreCart\n}\n","name":"GraphQL request","locationOffset":{"line":1,"column":1}};

var doc$9 = {"kind":"Document","definitions":[{"kind":"ObjectTypeDefinition","name":{"kind":"Name","value":"StoreOffer"},"interfaces":[],"directives":[],"fields":[{"kind":"FieldDefinition","name":{"kind":"Name","value":"listPrice"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Float"}}},"directives":[]},{"kind":"FieldDefinition","name":{"kind":"Name","value":"sellingPrice"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Float"}}},"directives":[]},{"kind":"FieldDefinition","name":{"kind":"Name","value":"priceCurrency"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},"directives":[]},{"kind":"FieldDefinition","name":{"kind":"Name","value":"price"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Float"}}},"directives":[]},{"kind":"FieldDefinition","name":{"kind":"Name","value":"priceValidUntil"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},"directives":[]},{"kind":"FieldDefinition","name":{"kind":"Name","value":"itemCondition"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},"directives":[]},{"kind":"FieldDefinition","name":{"kind":"Name","value":"availability"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},"directives":[]},{"kind":"FieldDefinition","name":{"kind":"Name","value":"seller"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"StoreOrganization"}}},"directives":[]},{"kind":"FieldDefinition","name":{"kind":"Name","value":"itemOffered"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"StoreProduct"}}},"directives":[]},{"kind":"FieldDefinition","name":{"kind":"Name","value":"quantity"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},"directives":[]}]},{"kind":"InputObjectTypeDefinition","name":{"kind":"Name","value":"IStoreOffer"},"directives":[],"fields":[{"kind":"InputValueDefinition","name":{"kind":"Name","value":"price"},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Float"}}},"directives":[]},{"kind":"InputValueDefinition","name":{"kind":"Name","value":"listPrice"},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Float"}}},"directives":[]},{"kind":"InputValueDefinition","name":{"kind":"Name","value":"seller"},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"IStoreOrganization"}}},"directives":[]},{"kind":"InputValueDefinition","name":{"kind":"Name","value":"itemOffered"},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"IStoreProduct"}}},"directives":[]},{"kind":"InputValueDefinition","name":{"kind":"Name","value":"quantity"},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},"directives":[]}]}],"loc":{"start":0,"end":419}};
    doc$9.loc.source = {"body":"type StoreOffer {\n  listPrice: Float!\n  sellingPrice: Float!\n  priceCurrency: String!\n  # Also known as spotPrice\n  price: Float!\n  priceValidUntil: String!\n  itemCondition: String!\n  availability: String!\n  seller: StoreOrganization!\n  itemOffered: StoreProduct!\n  quantity: Int!\n}\n\ninput IStoreOffer {\n  price: Float!\n  listPrice: Float!\n  seller: IStoreOrganization!\n  itemOffered: IStoreProduct!\n  quantity: Int!\n}\n","name":"GraphQL request","locationOffset":{"line":1,"column":1}};

var doc$a = {"kind":"Document","definitions":[{"kind":"ObjectTypeDefinition","name":{"kind":"Name","value":"StoreOrder"},"interfaces":[],"directives":[],"fields":[{"kind":"FieldDefinition","name":{"kind":"Name","value":"orderNumber"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},"directives":[]},{"kind":"FieldDefinition","name":{"kind":"Name","value":"acceptedOffer"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"StoreOffer"}}}}},"directives":[]}]},{"kind":"InputObjectTypeDefinition","name":{"kind":"Name","value":"IStoreOrder"},"directives":[],"fields":[{"kind":"InputValueDefinition","name":{"kind":"Name","value":"orderNumber"},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},"directives":[]},{"kind":"InputValueDefinition","name":{"kind":"Name","value":"acceptedOffer"},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"IStoreOffer"}}}}},"directives":[]}]}],"loc":{"start":0,"end":154}};
    doc$a.loc.source = {"body":"type StoreOrder {\n  orderNumber: String!\n  acceptedOffer: [StoreOffer!]!\n}\n\ninput IStoreOrder {\n  orderNumber: String!\n  acceptedOffer: [IStoreOffer!]!\n}\n","name":"GraphQL request","locationOffset":{"line":1,"column":1}};

var doc$b = {"kind":"Document","definitions":[{"kind":"ObjectTypeDefinition","name":{"kind":"Name","value":"StoreOrganization"},"interfaces":[],"directives":[],"fields":[{"kind":"FieldDefinition","name":{"kind":"Name","value":"identifier"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},"directives":[]}]},{"kind":"InputObjectTypeDefinition","name":{"kind":"Name","value":"IStoreOrganization"},"directives":[],"fields":[{"kind":"InputValueDefinition","name":{"kind":"Name","value":"identifier"},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},"directives":[]}]}],"loc":{"start":0,"end":101}};
    doc$b.loc.source = {"body":"type StoreOrganization {\n  identifier: String!\n}\n\ninput IStoreOrganization {\n  identifier: String!\n}\n","name":"GraphQL request","locationOffset":{"line":1,"column":1}};

var doc$c = {"kind":"Document","definitions":[{"kind":"ObjectTypeDefinition","name":{"kind":"Name","value":"StorePageInfo"},"interfaces":[],"directives":[],"fields":[{"kind":"FieldDefinition","name":{"kind":"Name","value":"hasNextPage"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}},"directives":[]},{"kind":"FieldDefinition","name":{"kind":"Name","value":"hasPreviousPage"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}},"directives":[]},{"kind":"FieldDefinition","name":{"kind":"Name","value":"startCursor"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},"directives":[]},{"kind":"FieldDefinition","name":{"kind":"Name","value":"endCursor"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},"directives":[]},{"kind":"FieldDefinition","name":{"kind":"Name","value":"totalCount"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},"directives":[]}]}],"loc":{"start":0,"end":197}};
    doc$c.loc.source = {"body":"type StorePageInfo {\n  hasNextPage: Boolean!\n  hasPreviousPage: Boolean!\n  startCursor: String!\n  endCursor: String!\n  # Total number of items(products/collections), not pages\n  totalCount: Int!\n}\n","name":"GraphQL request","locationOffset":{"line":1,"column":1}};

var doc$d = {"kind":"Document","definitions":[{"kind":"ObjectTypeDefinition","name":{"kind":"Name","value":"StoreProduct"},"interfaces":[],"directives":[],"fields":[{"kind":"FieldDefinition","name":{"kind":"Name","value":"seo"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"StoreSeo"}}},"directives":[]},{"kind":"FieldDefinition","name":{"kind":"Name","value":"breadcrumbList"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"StoreBreadcrumbList"}}},"directives":[]},{"kind":"FieldDefinition","name":{"kind":"Name","value":"slug"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},"directives":[]},{"kind":"FieldDefinition","name":{"kind":"Name","value":"name"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},"directives":[]},{"kind":"FieldDefinition","name":{"kind":"Name","value":"productID"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},"directives":[]},{"kind":"FieldDefinition","name":{"kind":"Name","value":"brand"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"StoreBrand"}}},"directives":[]},{"kind":"FieldDefinition","name":{"kind":"Name","value":"description"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},"directives":[]},{"kind":"FieldDefinition","name":{"kind":"Name","value":"image"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"StoreImage"}}}}},"directives":[]},{"kind":"FieldDefinition","name":{"kind":"Name","value":"offers"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"StoreAggregateOffer"}}},"directives":[]},{"kind":"FieldDefinition","name":{"kind":"Name","value":"sku"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},"directives":[]},{"kind":"FieldDefinition","name":{"kind":"Name","value":"gtin"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},"directives":[]},{"kind":"FieldDefinition","name":{"kind":"Name","value":"review"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"StoreReview"}}}}},"directives":[]},{"kind":"FieldDefinition","name":{"kind":"Name","value":"aggregateRating"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"StoreAggregateRating"}}},"directives":[]},{"kind":"FieldDefinition","name":{"kind":"Name","value":"isVariantOf"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"StoreProductGroup"}}},"directives":[]}]},{"kind":"InputObjectTypeDefinition","name":{"kind":"Name","value":"IStoreProduct"},"directives":[],"fields":[{"kind":"InputValueDefinition","name":{"kind":"Name","value":"sku"},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},"directives":[]},{"kind":"InputValueDefinition","name":{"kind":"Name","value":"name"},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},"directives":[]},{"kind":"InputValueDefinition","name":{"kind":"Name","value":"image"},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"IStoreImage"}}}}},"directives":[]}]}],"loc":{"start":0,"end":528}};
    doc$d.loc.source = {"body":"type StoreProduct {\n  # Meta tag data\n  seo: StoreSeo!\n  # Location for structured data\n  breadcrumbList: StoreBreadcrumbList!\n  # Where to retrieve this entity\n  slug: String!\n  name: String!\n  productID: String!\n  brand: StoreBrand!\n  description: String!\n  image: [StoreImage!]!\n  offers: StoreAggregateOffer!\n  sku: String!\n  gtin: String!\n  review: [StoreReview!]!\n  aggregateRating: StoreAggregateRating!\n  isVariantOf: StoreProductGroup!\n}\n\ninput IStoreProduct {\n  sku: String!\n  name: String!\n  image: [IStoreImage!]!\n}\n","name":"GraphQL request","locationOffset":{"line":1,"column":1}};

var doc$e = {"kind":"Document","definitions":[{"kind":"ObjectTypeDefinition","name":{"kind":"Name","value":"StoreProductGroup"},"interfaces":[],"directives":[],"fields":[{"kind":"FieldDefinition","name":{"kind":"Name","value":"hasVariant"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"StoreProduct"}}}}},"directives":[]},{"kind":"FieldDefinition","name":{"kind":"Name","value":"productGroupID"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},"directives":[]},{"kind":"FieldDefinition","name":{"kind":"Name","value":"name"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},"directives":[]}]}],"loc":{"start":0,"end":100}};
    doc$e.loc.source = {"body":"type StoreProductGroup {\n  hasVariant: [StoreProduct!]!\n  productGroupID: String!\n  name: String!\n}\n","name":"GraphQL request","locationOffset":{"line":1,"column":1}};

var doc$f = {"kind":"Document","definitions":[{"kind":"ObjectTypeDefinition","name":{"kind":"Name","value":"StoreProductEdge"},"interfaces":[],"directives":[],"fields":[{"kind":"FieldDefinition","name":{"kind":"Name","value":"node"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"StoreProduct"}}},"directives":[]},{"kind":"FieldDefinition","name":{"kind":"Name","value":"cursor"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},"directives":[]}]},{"kind":"ObjectTypeDefinition","name":{"kind":"Name","value":"StoreProductConnection"},"interfaces":[],"directives":[],"fields":[{"kind":"FieldDefinition","name":{"kind":"Name","value":"pageInfo"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"StorePageInfo"}}},"directives":[]},{"kind":"FieldDefinition","name":{"kind":"Name","value":"edges"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"StoreProductEdge"}}}}},"directives":[]}]},{"kind":"ObjectTypeDefinition","name":{"kind":"Name","value":"StoreCollectionEdge"},"interfaces":[],"directives":[],"fields":[{"kind":"FieldDefinition","name":{"kind":"Name","value":"node"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"StoreCollection"}}},"directives":[]},{"kind":"FieldDefinition","name":{"kind":"Name","value":"cursor"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},"directives":[]}]},{"kind":"ObjectTypeDefinition","name":{"kind":"Name","value":"StoreCollectionConnection"},"interfaces":[],"directives":[],"fields":[{"kind":"FieldDefinition","name":{"kind":"Name","value":"pageInfo"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"StorePageInfo"}}},"directives":[]},{"kind":"FieldDefinition","name":{"kind":"Name","value":"edges"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"StoreCollectionEdge"}}}}},"directives":[]}]},{"kind":"EnumTypeDefinition","name":{"kind":"Name","value":"StoreSort"},"directives":[],"values":[{"kind":"EnumValueDefinition","name":{"kind":"Name","value":"price_desc"},"directives":[]},{"kind":"EnumValueDefinition","name":{"kind":"Name","value":"price_asc"},"directives":[]},{"kind":"EnumValueDefinition","name":{"kind":"Name","value":"orders_desc"},"directives":[]},{"kind":"EnumValueDefinition","name":{"kind":"Name","value":"name_desc"},"directives":[]},{"kind":"EnumValueDefinition","name":{"kind":"Name","value":"name_asc"},"directives":[]},{"kind":"EnumValueDefinition","name":{"kind":"Name","value":"release_desc"},"directives":[]},{"kind":"EnumValueDefinition","name":{"kind":"Name","value":"discount_desc"},"directives":[]},{"kind":"EnumValueDefinition","name":{"kind":"Name","value":"score_desc"},"directives":[]}]},{"kind":"InputObjectTypeDefinition","name":{"kind":"Name","value":"IStoreSelectedFacet"},"directives":[],"fields":[{"kind":"InputValueDefinition","name":{"kind":"Name","value":"key"},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},"directives":[]},{"kind":"InputValueDefinition","name":{"kind":"Name","value":"value"},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},"directives":[]}]},{"kind":"EnumTypeDefinition","name":{"kind":"Name","value":"StoreFacetType"},"directives":[],"values":[{"kind":"EnumValueDefinition","name":{"kind":"Name","value":"BOOLEAN"},"directives":[]},{"kind":"EnumValueDefinition","name":{"kind":"Name","value":"RANGE"},"directives":[]}]},{"kind":"ObjectTypeDefinition","name":{"kind":"Name","value":"StoreSearchResult"},"interfaces":[],"directives":[],"fields":[{"kind":"FieldDefinition","name":{"kind":"Name","value":"products"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"StoreProductConnection"}}},"directives":[]},{"kind":"FieldDefinition","name":{"kind":"Name","value":"facets"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"StoreFacet"}}}}},"directives":[]}]},{"kind":"ObjectTypeDefinition","name":{"kind":"Name","value":"Query"},"interfaces":[],"directives":[],"fields":[{"kind":"FieldDefinition","name":{"kind":"Name","value":"product"},"arguments":[{"kind":"InputValueDefinition","name":{"kind":"Name","value":"locator"},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"IStoreSelectedFacet"}}}}},"directives":[]}],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"StoreProduct"}}},"directives":[]},{"kind":"FieldDefinition","name":{"kind":"Name","value":"collection"},"arguments":[{"kind":"InputValueDefinition","name":{"kind":"Name","value":"slug"},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},"directives":[]}],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"StoreCollection"}}},"directives":[]},{"kind":"FieldDefinition","name":{"kind":"Name","value":"search"},"arguments":[{"kind":"InputValueDefinition","name":{"kind":"Name","value":"first"},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},"directives":[]},{"kind":"InputValueDefinition","name":{"kind":"Name","value":"after"},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}},"directives":[]},{"kind":"InputValueDefinition","name":{"kind":"Name","value":"sort"},"type":{"kind":"NamedType","name":{"kind":"Name","value":"StoreSort"}},"defaultValue":{"kind":"EnumValue","value":"score_desc"},"directives":[]},{"kind":"InputValueDefinition","name":{"kind":"Name","value":"term"},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}},"defaultValue":{"kind":"StringValue","value":"","block":false},"directives":[]},{"kind":"InputValueDefinition","name":{"kind":"Name","value":"selectedFacets"},"type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"IStoreSelectedFacet"}}}},"directives":[]}],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"StoreSearchResult"}}},"directives":[]},{"kind":"FieldDefinition","name":{"kind":"Name","value":"allProducts"},"arguments":[{"kind":"InputValueDefinition","name":{"kind":"Name","value":"first"},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},"directives":[]},{"kind":"InputValueDefinition","name":{"kind":"Name","value":"after"},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}},"directives":[]}],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"StoreProductConnection"}}},"directives":[]},{"kind":"FieldDefinition","name":{"kind":"Name","value":"allCollections"},"arguments":[{"kind":"InputValueDefinition","name":{"kind":"Name","value":"first"},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},"directives":[]},{"kind":"InputValueDefinition","name":{"kind":"Name","value":"after"},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}},"directives":[]}],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"StoreCollectionConnection"}}},"directives":[]}]}],"loc":{"start":0,"end":1077}};
    doc$f.loc.source = {"body":"type StoreProductEdge {\n  node: StoreProduct!\n  cursor: String!\n}\n\ntype StoreProductConnection {\n  pageInfo: StorePageInfo!\n  edges: [StoreProductEdge!]!\n}\n\ntype StoreCollectionEdge {\n  node: StoreCollection!\n  cursor: String!\n}\n\ntype StoreCollectionConnection {\n  pageInfo: StorePageInfo!\n  edges: [StoreCollectionEdge!]!\n}\n\nenum StoreSort {\n  price_desc\n  price_asc\n  orders_desc\n  name_desc\n  name_asc\n  release_desc\n  discount_desc\n  score_desc\n}\n\ninput IStoreSelectedFacet {\n  key: String!\n  value: String!\n}\n\nenum StoreFacetType {\n  BOOLEAN\n  RANGE\n}\n\ntype StoreSearchResult {\n  products: StoreProductConnection!\n  facets: [StoreFacet!]!\n}\n\ntype Query {\n  product(locator: [IStoreSelectedFacet!]!): StoreProduct!\n\n  collection(slug: String!): StoreCollection!\n\n  search(\n    first: Int!\n    after: String\n    sort: StoreSort = score_desc\n    term: String = \"\"\n    selectedFacets: [IStoreSelectedFacet!]\n  ): StoreSearchResult!\n\n  allProducts(first: Int!, after: String): StoreProductConnection!\n\n  allCollections(first: Int!, after: String): StoreCollectionConnection!\n}\n","name":"GraphQL request","locationOffset":{"line":1,"column":1}};

var doc$g = {"kind":"Document","definitions":[{"kind":"ObjectTypeDefinition","name":{"kind":"Name","value":"StoreReviewRating"},"interfaces":[],"directives":[],"fields":[{"kind":"FieldDefinition","name":{"kind":"Name","value":"ratingValue"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Float"}}},"directives":[]},{"kind":"FieldDefinition","name":{"kind":"Name","value":"bestRating"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Float"}}},"directives":[]}]},{"kind":"ObjectTypeDefinition","name":{"kind":"Name","value":"StoreReview"},"interfaces":[],"directives":[],"fields":[{"kind":"FieldDefinition","name":{"kind":"Name","value":"reviewRating"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"StoreReviewRating"}}},"directives":[]},{"kind":"FieldDefinition","name":{"kind":"Name","value":"author"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"StoreAuthor"}}},"directives":[]}]}],"loc":{"start":0,"end":150}};
    doc$g.loc.source = {"body":"type StoreReviewRating {\n  ratingValue: Float!\n  bestRating: Float!\n}\n\ntype StoreReview {\n  reviewRating: StoreReviewRating!\n  author: StoreAuthor!\n}\n","name":"GraphQL request","locationOffset":{"line":1,"column":1}};

var doc$h = {"kind":"Document","definitions":[{"kind":"ObjectTypeDefinition","name":{"kind":"Name","value":"StoreSeo"},"interfaces":[],"directives":[],"fields":[{"kind":"FieldDefinition","name":{"kind":"Name","value":"title"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},"directives":[]},{"kind":"FieldDefinition","name":{"kind":"Name","value":"titleTemplate"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},"directives":[]},{"kind":"FieldDefinition","name":{"kind":"Name","value":"description"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},"directives":[]},{"kind":"FieldDefinition","name":{"kind":"Name","value":"canonical"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},"directives":[]}]}],"loc":{"start":0,"end":104}};
    doc$h.loc.source = {"body":"type StoreSeo {\n  title: String!\n  titleTemplate: String!\n  description: String!\n  canonical: String!\n}\n","name":"GraphQL request","locationOffset":{"line":1,"column":1}};

var doc$i = {"kind":"Document","definitions":[{"kind":"ObjectTypeDefinition","name":{"kind":"Name","value":"StoreCartMessage"},"interfaces":[],"directives":[],"fields":[{"kind":"FieldDefinition","name":{"kind":"Name","value":"text"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},"directives":[]},{"kind":"FieldDefinition","name":{"kind":"Name","value":"status"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"StoreStatus"}}},"directives":[]}]},{"kind":"ObjectTypeDefinition","name":{"kind":"Name","value":"StoreCart"},"interfaces":[],"directives":[],"fields":[{"kind":"FieldDefinition","name":{"kind":"Name","value":"order"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"StoreOrder"}}},"directives":[]},{"kind":"FieldDefinition","name":{"kind":"Name","value":"messages"},"arguments":[],"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"StoreCartMessage"}}}}},"directives":[]}]},{"kind":"InputObjectTypeDefinition","name":{"kind":"Name","value":"IStoreCart"},"directives":[],"fields":[{"kind":"InputValueDefinition","name":{"kind":"Name","value":"order"},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"IStoreOrder"}}},"directives":[]}]}],"loc":{"start":0,"end":183}};
    doc$i.loc.source = {"body":"type StoreCartMessage {\n  text: String!\n  status: StoreStatus!\n}\n\ntype StoreCart {\n  order: StoreOrder!\n  messages: [StoreCartMessage!]!\n}\n\ninput IStoreCart {\n  order: IStoreOrder!\n}\n","name":"GraphQL request","locationOffset":{"line":1,"column":1}};

var doc$j = {"kind":"Document","definitions":[{"kind":"EnumTypeDefinition","name":{"kind":"Name","value":"StoreStatus"},"directives":[],"values":[{"kind":"EnumValueDefinition","name":{"kind":"Name","value":"INFO"},"directives":[]},{"kind":"EnumValueDefinition","name":{"kind":"Name","value":"WARNING"},"directives":[]},{"kind":"EnumValueDefinition","name":{"kind":"Name","value":"ERROR"},"directives":[]}]}],"loc":{"start":0,"end":46}};
    doc$j.loc.source = {"body":"enum StoreStatus {\n  INFO\n  WARNING\n  ERROR\n}\n","name":"GraphQL request","locationOffset":{"line":1,"column":1}};

const typeDefs = /*#__PURE__*/[doc$f, doc$8, doc$3, doc$4, doc$5, doc$6, doc$7, doc$c, doc$d, doc$h, doc$9, doc$1, doc$g, doc$2, doc$e, doc$b, doc, doc$a, doc$i, doc$j].map(print).join('\n');

const platforms = {
  vtex: {
    getResolvers: getResolvers,
    getContextFactory: getContextFactory
  }
};
const getTypeDefs = () => typeDefs;
const getResolvers$1 = options => platforms[options.platform].getResolvers(options);
const getContextFactory$1 = options => platforms[options.platform].getContextFactory(options);
const getSchema = async options => makeExecutableSchema({
  resolvers: getResolvers$1(options),
  typeDefs: getTypeDefs()
});

export { getContextFactory$1 as getContextFactory, getResolvers$1 as getResolvers, getSchema, getTypeDefs };
//# sourceMappingURL=api.esm.js.map
