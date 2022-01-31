import type { Resolver } from '..';
import type { Brand } from '../clients/commerce/types/Brand';
import type { CategoryTree } from '../clients/commerce/types/CategoryTree';
import type { PortalPagetype } from '../clients/commerce/types/Portal';
declare type Root = Brand | (CategoryTree & {
    level: number;
}) | PortalPagetype;
export declare const StoreCollection: Record<string, Resolver<Root>>;
export {};
