import DataLoader from 'dataloader';
import type { PayloadItem, Simulation } from '../clients/commerce/types/Simulation';
import type { Options } from '..';
import type { Clients } from '../clients';
export declare const getSimulationLoader: (_: Options, clients: Clients) => DataLoader<PayloadItem[], Simulation, PayloadItem[]>;
