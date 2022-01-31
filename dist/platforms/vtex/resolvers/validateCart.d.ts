import type { IStoreCart } from '../../../__generated__/schema';
import type { Context } from '..';
/**
 * This resolver implements the optimistic cart behavior. The main idea in here
 * is that we receive a cart from the UI (as query params) and we validate it with
 * the commerce platform. If the cart is valid, we return null, if the cart is
 * invalid according to the commerce platform, we return the new cart the UI should use
 * instead
 *
 * The algoritm is something like:
 * 1. Fetch orderForm from VTEX
 * 2. Compute delta changes between the orderForm and the UI's cart
 * 3. Update the orderForm in VTEX platform accordingly
 * 4. If any chages were made, send to the UI the new cart. Null otherwise
 */
export declare const validateCart: (_: unknown, { cart: { order: { orderNumber, acceptedOffer }, }, }: {
    cart: IStoreCart;
}, ctx: Context) => Promise<{
    order: {
        orderNumber: string;
        acceptedOffer: {
            product: Promise<import("../utils/enhanceSku").EnhancedSku>;
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
            parentAssemblyBinding: string | null;
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
            skuSpecifications: import("../clients/commerce/types/OrderForm").SKUSpecification[];
            priceDefinition: {
                calculatedSellingPrice: number;
                sellingPrices: import("../clients/commerce/types/OrderForm").SellingPrice[];
                total: number;
            };
        }[];
    };
    messages: {
        text: any;
        status: any;
    }[];
} | null>;
