import type { Resolver } from '..';
import type { SearchArgs } from '../clients/search';
declare type Root = Omit<SearchArgs, 'type'>;
export declare const StoreSearchResult: Record<string, Resolver<Root>>;
export {};
