import type { Options as OptionsVTEX } from './platforms/vtex';
export * from './__generated__/schema';
export declare type Options = OptionsVTEX;
export declare const getTypeDefs: () => string;
export declare const getResolvers: (options: Options) => {
    StoreCollection: Record<string, import("./platforms/vtex").Resolver<import("./platforms/vtex/clients/commerce/types/Brand").Brand | (import("./platforms/vtex/clients/commerce/types/CategoryTree").CategoryTree & {
        level: number;
    }) | import("./platforms/vtex/clients/commerce/types/Portal").PortalPagetype, unknown>>;
    StoreAggregateOffer: Record<string, (root: import("./platforms/vtex/clients/commerce/types/Simulation").Simulation & {
        product: import("./platforms/vtex/utils/enhanceSku").EnhancedSku;
    }) => unknown>;
    StoreProduct: Record<string, import("./platforms/vtex").Resolver<import("./platforms/vtex/utils/enhanceSku").EnhancedSku, unknown>>;
    StoreSeo: Record<string, import("./platforms/vtex").Resolver<{
        title?: string | undefined;
        description?: string | undefined;
    }, unknown>>;
    StoreFacet: Record<string, import("./platforms/vtex").Resolver<import("./platforms/vtex/clients/search/types/AttributeSearchResult").Attribute, unknown>>;
    StoreFacetValue: Record<string, import("./platforms/vtex").Resolver<import("./platforms/vtex/clients/search/types/AttributeSearchResult").Value, unknown>>;
    StoreOffer: Record<string, import("./platforms/vtex").Resolver<(import("./platforms/vtex/clients/commerce/types/Simulation").Item & {
        product: import("./platforms/vtex/utils/enhanceSku").EnhancedSku;
    }) | (import("./platforms/vtex/clients/commerce/types/OrderForm").OrderFormItem & {
        product: Promise<import("./platforms/vtex/utils/enhanceSku").EnhancedSku>;
    }), unknown>>;
    StoreAggregateRating: Record<string, import("./platforms/vtex").Resolver<unknown, unknown>>;
    StoreReview: Record<string, import("./platforms/vtex").Resolver<unknown, unknown>>;
    StoreProductGroup: Record<string, import("./platforms/vtex").Resolver<import("./platforms/vtex/clients/search/types/ProductSearchResult").Product, unknown>>;
    StoreSearchResult: Record<string, import("./platforms/vtex").Resolver<Pick<import("./platforms/vtex/clients/search").SearchArgs, "query" | "page" | "count" | "sort" | "selectedFacets" | "fuzzy">, unknown>>;
    Query: {
        product: (_: unknown, { locator }: import("./__generated__/schema").QueryProductArgs, ctx: import("./platforms/vtex").Context) => Promise<import("./platforms/vtex/utils/enhanceSku").EnhancedSku>;
        collection: (_: unknown, { slug }: import("./__generated__/schema").QueryCollectionArgs, ctx: import("./platforms/vtex").Context) => Promise<import("./platforms/vtex/clients/commerce/types/Portal").PortalPagetype>;
        search: (_: unknown, { first, after: maybeAfter, sort, term, selectedFacets }: import("./__generated__/schema").QuerySearchArgs, ctx: import("./platforms/vtex").Context) => Promise<{
            page: number;
            count: number;
            query: string | null | undefined;
            sort: import("./platforms/vtex/clients/search").Sort;
            selectedFacets: {
                key: string;
                value: string;
            }[];
        }>;
        allProducts: (_: unknown, { first, after: maybeAfter }: import("./__generated__/schema").QueryAllProductsArgs, ctx: import("./platforms/vtex").Context) => Promise<{
            pageInfo: {
                hasNextPage: boolean;
                hasPreviousPage: boolean;
                startCursor: string;
                endCursor: string;
                totalCount: number;
            };
            edges: {
                node: import("./platforms/vtex/utils/enhanceSku").EnhancedSku;
                cursor: string;
            }[];
        }>;
        allCollections: (_: unknown, __: import("./__generated__/schema").QueryAllCollectionsArgs, ctx: import("./platforms/vtex").Context) => Promise<{
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
                    imageURL: import("./__generated__/schema").Maybe<string>;
                } | (import("./platforms/vtex/clients/commerce/types/CategoryTree").CategoryTree & {
                    level: number;
                });
                cursor: string;
            }[];
        }>;
    };
    Mutation: {
        validateCart: (_: unknown, { cart: { order: { orderNumber, acceptedOffer }, }, }: {
            cart: import("./__generated__/schema").IStoreCart;
        }, ctx: import("./platforms/vtex").Context) => Promise<{
            order: {
                orderNumber: string;
                acceptedOffer: {
                    product: Promise<import("./platforms/vtex/utils/enhanceSku").EnhancedSku>;
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
                    parentAssemblyBinding: import("./__generated__/schema").Maybe<string>;
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
                    skuSpecifications: import("./platforms/vtex/clients/commerce/types/OrderForm").SKUSpecification[];
                    priceDefinition: {
                        calculatedSellingPrice: number;
                        sellingPrices: import("./platforms/vtex/clients/commerce/types/OrderForm").SellingPrice[];
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
export declare const getContextFactory: (options: Options) => (ctx: any) => any;
export declare const getSchema: (options: Options) => Promise<import("graphql").GraphQLSchema>;
