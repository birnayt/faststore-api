export declare const Mutation: {
    validateCart: (_: unknown, { cart: { order: { orderNumber, acceptedOffer }, }, }: {
        cart: import("../../..").IStoreCart;
    }, ctx: import("..").Context) => Promise<{
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
};
