import type { EnhancedSku } from '../utils/enhanceSku';
import type { Resolver } from '..';
import type { Item } from '../clients/commerce/types/Simulation';
import type { OrderFormItem } from '../clients/commerce/types/OrderForm';
declare type Root = (Item & {
    product: EnhancedSku;
}) | (OrderFormItem & {
    product: Promise<EnhancedSku>;
});
export declare const StoreOffer: Record<string, Resolver<Root>>;
export {};
