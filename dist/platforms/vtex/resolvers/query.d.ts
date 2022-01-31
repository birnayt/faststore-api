import type { QueryProductArgs, QueryAllCollectionsArgs, QueryAllProductsArgs, QuerySearchArgs, QueryCollectionArgs } from '../../../__generated__/schema';
import type { CategoryTree } from '../clients/commerce/types/CategoryTree';
import type { Context } from '../index';
export declare const Query: {
    product: (_: unknown, { locator }: QueryProductArgs, ctx: Context) => Promise<import("../utils/enhanceSku").EnhancedSku>;
    collection: (_: unknown, { slug }: QueryCollectionArgs, ctx: Context) => Promise<import("../clients/commerce/types/Portal").PortalPagetype>;
    search: (_: unknown, { first, after: maybeAfter, sort, term, selectedFacets }: QuerySearchArgs, ctx: Context) => Promise<{
        page: number;
        count: number;
        query: string | null | undefined;
        sort: import("../clients/search").Sort;
        selectedFacets: {
            key: string;
            value: string;
        }[];
    }>;
    allProducts: (_: unknown, { first, after: maybeAfter }: QueryAllProductsArgs, ctx: Context) => Promise<{
        pageInfo: {
            hasNextPage: boolean;
            hasPreviousPage: boolean;
            startCursor: string;
            endCursor: string;
            totalCount: number;
        };
        edges: {
            node: import("../utils/enhanceSku").EnhancedSku;
            cursor: string;
        }[];
    }>;
    allCollections: (_: unknown, __: QueryAllCollectionsArgs, ctx: Context) => Promise<{
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
                imageURL: import("../../../__generated__/schema").Maybe<string>;
            } | (CategoryTree & {
                level: number;
            });
            cursor: string;
        }[];
    }>;
};
