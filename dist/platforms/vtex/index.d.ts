import type { Loaders } from './loaders';
import type { Clients } from './clients';
export interface Options {
    platform: 'vtex';
    account: string;
    environment: 'vtexcommercestable' | 'vtexcommercebeta';
    channel: string;
}
export interface Context {
    clients: Clients;
    loaders: Loaders;
    /**
     * @description Storage updated at each request.
     *
     * Use this datastructure to store and share small values in the context.
     * Use it with caution since dependecy injection leads to a more complex code
     * */
    storage: {
        channel: string;
    };
}
export declare type Resolver<R = unknown, A = unknown> = (root: R, args: A, ctx: Context, info: any) => any;
export declare const getContextFactory: (options: Options) => (ctx: any) => any;
export declare const getResolvers: (_: Options) => {
    StoreCollection: Record<string, Resolver<import("./clients/commerce/types/Brand").Brand | import("./clients/commerce/types/Portal").PortalPagetype | (import("./clients/commerce/types/CategoryTree").CategoryTree & {
        level: number;
    }), unknown>>;
    StoreAggregateOffer: Record<string, (root: import("./clients/commerce/types/Simulation").Simulation & {
        product: import("./utils/enhanceSku").EnhancedSku;
    }) => unknown>;
    StoreProduct: Record<string, Resolver<import("./utils/enhanceSku").EnhancedSku, unknown>>;
    StoreSeo: Record<string, Resolver<{
        title?: string | undefined;
        description?: string | undefined;
    }, unknown>>;
    StoreFacet: Record<string, Resolver<import("./clients/search/types/AttributeSearchResult").Attribute, unknown>>;
    StoreFacetValue: Record<string, Resolver<import("./clients/search/types/AttributeSearchResult").Value, unknown>>;
    StoreOffer: Record<string, Resolver<(import("./clients/commerce/types/Simulation").Item & {
        product: import("./utils/enhanceSku").EnhancedSku;
    }) | (import("./clients/commerce/types/OrderForm").OrderFormItem & {
        product: Promise<import("./utils/enhanceSku").EnhancedSku>;
    }), unknown>>;
    StoreAggregateRating: Record<string, Resolver<unknown, unknown>>;
    StoreReview: Record<string, Resolver<unknown, unknown>>;
    StoreProductGroup: Record<string, Resolver<import("./clients/search/types/ProductSearchResult").Product, unknown>>;
    StoreSearchResult: Record<string, Resolver<Pick<import("./clients/search").SearchArgs, "query" | "page" | "count" | "sort" | "selectedFacets" | "fuzzy">, unknown>>;
    Query: {
        product: (_: unknown, { locator }: import("../..").QueryProductArgs, ctx: Context) => Promise<import("./utils/enhanceSku").EnhancedSku>;
        collection: (_: unknown, { slug }: import("../..").QueryCollectionArgs, ctx: Context) => Promise<import("./clients/commerce/types/Portal").PortalPagetype>;
        search: (_: unknown, { first, after: maybeAfter, sort, term, selectedFacets }: import("../..").QuerySearchArgs, ctx: Context) => Promise<{
            page: number;
            count: number;
            query: string | null | undefined;
            sort: import("./clients/search").Sort;
            selectedFacets: {
                key: string;
                value: string;
            }[];
        }>;
        allProducts: (_: unknown, { first, after: maybeAfter }: import("../..").QueryAllProductsArgs, ctx: Context) => Promise<{
            pageInfo: {
                hasNextPage: boolean;
                hasPreviousPage: boolean;
                startCursor: string;
                endCursor: string;
                totalCount: number;
            };
            edges: {
                node: import("./utils/enhanceSku").EnhancedSku;
                cursor: string;
            }[];
        }>;
        allCollections: (_: unknown, __: import("../..").QueryAllCollectionsArgs, ctx: Context) => Promise<{
            pageInfo: {
                hasNextPage: boolean;
                hasPreviousPage: boolean;
                startCursor: string;
                endCursor: string;
            };
            edges: {
                node: {
                    type: string;
                    id: number;
                    name: string;
                    isActive: boolean;
                    title: string;
                    metaTagDescription: string;
                    imageURL: import("../..").Maybe<string>;
                } | (import("./clients/commerce/types/CategoryTree").CategoryTree & {
                    level: number;
                });
                cursor: string;
            }[];
        }>;
    };
    Mutation: {
        validateCart: (_: unknown, { cart: { order: { orderNumber, acceptedOffer }, }, }: {
            cart: import("../..").IStoreCart;
        }, ctx: Context) => Promise<{
            order: {
                orderNumber: string;
                acceptedOffer: {
                    product: Promise<import("./utils/enhanceSku").EnhancedSku>;
                    id: string;
                    name: string;
                    detailUrl: string;
                    imageUrl: string;
                    skuName: string;
                    quantity: number;
                    uniqueId: string;
                    productId: string;
                    refId: string;
                    ean: string;
                    priceValidUntil: string;
                    price: number;
                    tax: number;
                    listPrice: number;
                    sellingPrice: number;
                    rewardValue: number;
                    isGift: boolean;
                    parentItemIndex: number | null;
                    parentAssemblyBinding: import("../..").Maybe<string>;
                    productCategoryIds: string;
                    priceTags: string[];
                    manualPrice: number;
                    measurementUnit: string;
                    additionalInfo: {
                        brandName: string;
                        brandId: string;
                        offeringInfo: any;
                        offeringType: any;
                        offeringTypeId: any;
                    };
                    productCategories: Record<string, string>;
                    productRefId: string;
                    seller: string;
                    sellerChain: string[];
                    availability: string;
                    unitMultiplier: number;
                    skuSpecifications: import("./clients/commerce/types/OrderForm").SKUSpecification[];
                    priceDefinition: {
                        calculatedSellingPrice: number;
                        sellingPrices: import("./clients/commerce/types/OrderForm").SellingPrice[];
                        total: number;
                    };
                }[];
            };
            messages: {
                text: any;
                status: any;
            }[];
        } | null>;
    };
};
