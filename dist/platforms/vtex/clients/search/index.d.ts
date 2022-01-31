import type { Context, Options } from '../../index';
import type { SelectedFacet } from '../../utils/facets';
import type { ProductSearchResult } from './types/ProductSearchResult';
import type { AttributeSearchResult } from './types/AttributeSearchResult';
export declare type Sort = 'price:desc' | 'price:asc' | 'orders:desc' | 'name:desc' | 'name:asc' | 'release:desc' | 'discount:desc' | '';
export interface SearchArgs {
    query?: string;
    page: number;
    count: number;
    type: 'product_search' | 'attribute_search';
    sort?: Sort;
    selectedFacets?: SelectedFacet[];
    fuzzy?: '0' | '1';
}
export interface ProductLocator {
    field: 'id' | 'slug';
    value: string;
}
export declare const IntelligentSearch: ({ account, environment }: Options, ctx: Context) => {
    facets: (args: Omit<SearchArgs, 'type'>) => Promise<AttributeSearchResult>;
    products: (args: Omit<SearchArgs, 'type'>) => Promise<ProductSearchResult>;
};
