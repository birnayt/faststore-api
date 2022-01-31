import type { Context, Options } from '../../index';
import type { Brand } from './types/Brand';
import type { CategoryTree } from './types/CategoryTree';
import type { OrderForm, OrderFormInputItem } from './types/OrderForm';
import type { PortalPagetype } from './types/Portal';
import type { Simulation, SimulationArgs, SimulationOptions } from './types/Simulation';
export declare const VtexCommerce: ({ account, environment }: Options, ctx: Context) => {
    catalog: {
        brand: {
            list: () => Promise<Brand[]>;
        };
        category: {
            tree: (depth?: number) => Promise<CategoryTree[]>;
        };
        portal: {
            pagetype: (slug: string) => Promise<PortalPagetype>;
        };
    };
    checkout: {
        simulation: (args: SimulationArgs, { salesChannel }?: SimulationOptions) => Promise<Simulation>;
        orderForm: ({ id, refreshOutdatedData, salesChannel, }: {
            id: string;
            refreshOutdatedData?: boolean | undefined;
            salesChannel?: string | undefined;
        }) => Promise<OrderForm>;
        updateOrderFormItems: ({ id, orderItems, allowOutdatedData, salesChannel, }: {
            id: string;
            orderItems: OrderFormInputItem[];
            allowOutdatedData?: "paymentData" | undefined;
            salesChannel?: string | undefined;
        }) => Promise<OrderForm>;
    };
};
