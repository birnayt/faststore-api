export declare type Maybe<T> = T | null;
export declare type Exact<T extends {
    [key: string]: unknown;
}> = {
    [K in keyof T]: T[K];
};
export declare type MakeOptional<T, K extends keyof T> = Omit<T, K> & {
    [SubKey in K]?: Maybe<T[SubKey]>;
};
export declare type MakeMaybe<T, K extends keyof T> = Omit<T, K> & {
    [SubKey in K]: Maybe<T[SubKey]>;
};
/** All built-in and custom scalars, mapped to their actual values */
export declare type Scalars = {
    ID: string;
    String: string;
    Boolean: boolean;
    Int: number;
    Float: number;
};
export declare type IStoreCart = {
    order: IStoreOrder;
};
export declare type IStoreImage = {
    alternateName: Scalars['String'];
    url: Scalars['String'];
};
export declare type IStoreOffer = {
    itemOffered: IStoreProduct;
    listPrice: Scalars['Float'];
    price: Scalars['Float'];
    quantity: Scalars['Int'];
    seller: IStoreOrganization;
};
export declare type IStoreOrder = {
    acceptedOffer: Array<IStoreOffer>;
    orderNumber: Scalars['String'];
};
export declare type IStoreOrganization = {
    identifier: Scalars['String'];
};
export declare type IStoreProduct = {
    image: Array<IStoreImage>;
    name: Scalars['String'];
    sku: Scalars['String'];
};
export declare type IStoreSelectedFacet = {
    key: Scalars['String'];
    value: Scalars['String'];
};
export declare type Mutation = {
    __typename?: 'Mutation';
    validateCart?: Maybe<StoreCart>;
};
export declare type MutationValidateCartArgs = {
    cart: IStoreCart;
};
export declare type Query = {
    __typename?: 'Query';
    allCollections: StoreCollectionConnection;
    allProducts: StoreProductConnection;
    collection: StoreCollection;
    product: StoreProduct;
    search: StoreSearchResult;
};
export declare type QueryAllCollectionsArgs = {
    after?: Maybe<Scalars['String']>;
    first: Scalars['Int'];
};
export declare type QueryAllProductsArgs = {
    after?: Maybe<Scalars['String']>;
    first: Scalars['Int'];
};
export declare type QueryCollectionArgs = {
    slug: Scalars['String'];
};
export declare type QueryProductArgs = {
    locator: Array<IStoreSelectedFacet>;
};
export declare type QuerySearchArgs = {
    after?: Maybe<Scalars['String']>;
    first: Scalars['Int'];
    selectedFacets?: Maybe<Array<IStoreSelectedFacet>>;
    sort?: Maybe<StoreSort>;
    term?: Maybe<Scalars['String']>;
};
export declare type StoreAggregateOffer = {
    __typename?: 'StoreAggregateOffer';
    highPrice: Scalars['Float'];
    lowPrice: Scalars['Float'];
    offerCount: Scalars['Int'];
    offers: Array<StoreOffer>;
    priceCurrency: Scalars['String'];
};
export declare type StoreAggregateRating = {
    __typename?: 'StoreAggregateRating';
    ratingValue: Scalars['Float'];
    reviewCount: Scalars['Int'];
};
export declare type StoreAuthor = {
    __typename?: 'StoreAuthor';
    name: Scalars['String'];
};
export declare type StoreBrand = {
    __typename?: 'StoreBrand';
    name: Scalars['String'];
};
export declare type StoreBreadcrumbList = {
    __typename?: 'StoreBreadcrumbList';
    itemListElement: Array<StoreListItem>;
    numberOfItems: Scalars['Int'];
};
export declare type StoreCart = {
    __typename?: 'StoreCart';
    messages: Array<StoreCartMessage>;
    order: StoreOrder;
};
export declare type StoreCartMessage = {
    __typename?: 'StoreCartMessage';
    status: StoreStatus;
    text: Scalars['String'];
};
export declare type StoreCollection = {
    __typename?: 'StoreCollection';
    breadcrumbList: StoreBreadcrumbList;
    id: Scalars['ID'];
    meta: StoreCollectionMeta;
    seo: StoreSeo;
    slug: Scalars['String'];
    type: StoreCollectionType;
};
export declare type StoreCollectionConnection = {
    __typename?: 'StoreCollectionConnection';
    edges: Array<StoreCollectionEdge>;
    pageInfo: StorePageInfo;
};
export declare type StoreCollectionEdge = {
    __typename?: 'StoreCollectionEdge';
    cursor: Scalars['String'];
    node: StoreCollection;
};
export declare type StoreCollectionFacet = {
    __typename?: 'StoreCollectionFacet';
    key: Scalars['String'];
    value: Scalars['String'];
};
export declare type StoreCollectionMeta = {
    __typename?: 'StoreCollectionMeta';
    selectedFacets: Array<StoreCollectionFacet>;
};
export declare const enum StoreCollectionType {
    Brand = "Brand",
    Category = "Category",
    Cluster = "Cluster",
    Department = "Department"
}
export declare type StoreFacet = {
    __typename?: 'StoreFacet';
    key: Scalars['String'];
    label: Scalars['String'];
    type: StoreFacetType;
    values: Array<StoreFacetValue>;
};
export declare const enum StoreFacetType {
    Boolean = "BOOLEAN",
    Range = "RANGE"
}
export declare type StoreFacetValue = {
    __typename?: 'StoreFacetValue';
    label: Scalars['String'];
    quantity: Scalars['Int'];
    selected: Scalars['Boolean'];
    value: Scalars['String'];
};
export declare type StoreImage = {
    __typename?: 'StoreImage';
    alternateName: Scalars['String'];
    url: Scalars['String'];
};
export declare type StoreListItem = {
    __typename?: 'StoreListItem';
    item: Scalars['String'];
    name: Scalars['String'];
    position: Scalars['Int'];
};
export declare type StoreOffer = {
    __typename?: 'StoreOffer';
    availability: Scalars['String'];
    itemCondition: Scalars['String'];
    itemOffered: StoreProduct;
    listPrice: Scalars['Float'];
    price: Scalars['Float'];
    priceCurrency: Scalars['String'];
    priceValidUntil: Scalars['String'];
    quantity: Scalars['Int'];
    seller: StoreOrganization;
    sellingPrice: Scalars['Float'];
};
export declare type StoreOrder = {
    __typename?: 'StoreOrder';
    acceptedOffer: Array<StoreOffer>;
    orderNumber: Scalars['String'];
};
export declare type StoreOrganization = {
    __typename?: 'StoreOrganization';
    identifier: Scalars['String'];
};
export declare type StorePageInfo = {
    __typename?: 'StorePageInfo';
    endCursor: Scalars['String'];
    hasNextPage: Scalars['Boolean'];
    hasPreviousPage: Scalars['Boolean'];
    startCursor: Scalars['String'];
    totalCount: Scalars['Int'];
};
export declare type StoreProduct = {
    __typename?: 'StoreProduct';
    aggregateRating: StoreAggregateRating;
    brand: StoreBrand;
    breadcrumbList: StoreBreadcrumbList;
    description: Scalars['String'];
    gtin: Scalars['String'];
    image: Array<StoreImage>;
    isVariantOf: StoreProductGroup;
    name: Scalars['String'];
    offers: StoreAggregateOffer;
    productID: Scalars['String'];
    review: Array<StoreReview>;
    seo: StoreSeo;
    sku: Scalars['String'];
    slug: Scalars['String'];
};
export declare type StoreProductConnection = {
    __typename?: 'StoreProductConnection';
    edges: Array<StoreProductEdge>;
    pageInfo: StorePageInfo;
};
export declare type StoreProductEdge = {
    __typename?: 'StoreProductEdge';
    cursor: Scalars['String'];
    node: StoreProduct;
};
export declare type StoreProductGroup = {
    __typename?: 'StoreProductGroup';
    hasVariant: Array<StoreProduct>;
    name: Scalars['String'];
    productGroupID: Scalars['String'];
};
export declare type StoreReview = {
    __typename?: 'StoreReview';
    author: StoreAuthor;
    reviewRating: StoreReviewRating;
};
export declare type StoreReviewRating = {
    __typename?: 'StoreReviewRating';
    bestRating: Scalars['Float'];
    ratingValue: Scalars['Float'];
};
export declare type StoreSearchResult = {
    __typename?: 'StoreSearchResult';
    facets: Array<StoreFacet>;
    products: StoreProductConnection;
};
export declare type StoreSeo = {
    __typename?: 'StoreSeo';
    canonical: Scalars['String'];
    description: Scalars['String'];
    title: Scalars['String'];
    titleTemplate: Scalars['String'];
};
export declare const enum StoreSort {
    DiscountDesc = "discount_desc",
    NameAsc = "name_asc",
    NameDesc = "name_desc",
    OrdersDesc = "orders_desc",
    PriceAsc = "price_asc",
    PriceDesc = "price_desc",
    ReleaseDesc = "release_desc",
    ScoreDesc = "score_desc"
}
export declare const enum StoreStatus {
    Error = "ERROR",
    Info = "INFO",
    Warning = "WARNING"
}
