import DataLoader from 'dataloader';
import type { EnhancedSku } from '../utils/enhanceSku';
import type { Options } from '..';
import type { Clients } from '../clients';
import type { SelectedFacet } from '../utils/facets';
export declare const getSkuLoader: (_: Options, clients: Clients) => DataLoader<SelectedFacet[], EnhancedSku, SelectedFacet[]>;
