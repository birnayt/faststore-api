import type { Context, Options } from '..';
export declare type Clients = ReturnType<typeof getClients>;
export declare const getClients: (options: Options, ctx: Context) => {
    search: {
        facets: (args: Pick<import("./search").SearchArgs, "query" | "page" | "count" | "sort" | "selectedFacets" | "fuzzy">) => Promise<import("./search/types/AttributeSearchResult").AttributeSearchResult>;
        products: (args: Pick<import("./search").SearchArgs, "query" | "page" | "count" | "sort" | "selectedFacets" | "fuzzy">) => Promise<import("./search/types/ProductSearchResult").ProductSearchResult>;
    };
    commerce: {
        catalog: {
            brand: {
                list: () => Promise<import("./commerce/types/Brand").Brand[]>;
            };
            category: {
                tree: (depth?: number) => Promise<import("./commerce/types/CategoryTree").CategoryTree[]>;
            };
            portal: {
                pagetype: (slug: string) => Promise<import("./commerce/types/Portal").PortalPagetype>;
            };
        };
        checkout: {
            simulation: (args: import("./commerce/types/Simulation").SimulationArgs, { salesChannel }?: import("./commerce/types/Simulation").SimulationOptions) => Promise<import("./commerce/types/Simulation").Simulation>;
            orderForm: ({ id, refreshOutdatedData, salesChannel, }: {
                id: string;
                refreshOutdatedData?: boolean | undefined;
                salesChannel?: string | undefined;
            }) => Promise<import("./commerce/types/OrderForm").OrderForm>;
            updateOrderFormItems: ({ id, orderItems, allowOutdatedData, salesChannel, }: {
                id: string;
                orderItems: import("./commerce/types/OrderForm").OrderFormInputItem[];
                allowOutdatedData?: "paymentData" | undefined;
                salesChannel?: string | undefined;
            }) => Promise<import("./commerce/types/OrderForm").OrderForm>;
        };
    };
};
