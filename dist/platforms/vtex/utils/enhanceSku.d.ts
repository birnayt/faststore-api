import type { Product, Sku } from '../clients/search/types/ProductSearchResult';
export declare type EnhancedSku = Sku & {
    isVariantOf: Product;
};
export declare const enhanceSku: (sku: Sku, product: Product) => EnhancedSku;
