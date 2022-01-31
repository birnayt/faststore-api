import type { EnhancedSku } from '../utils/enhanceSku';
import type { Simulation } from '../clients/commerce/types/Simulation';
declare type Resolvers = (root: Simulation & {
    product: EnhancedSku;
}) => unknown;
export declare const StoreAggregateOffer: Record<string, Resolvers>;
export {};
