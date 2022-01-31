import type { Context, Options } from '..';
export declare type Loaders = ReturnType<typeof getLoaders>;
export declare const getLoaders: (options: Options, { clients }: Context) => {
    skuLoader: import("dataloader")<import("../utils/facets").SelectedFacet[], import("../utils/enhanceSku").EnhancedSku, import("../utils/facets").SelectedFacet[]>;
    simulationLoader: import("dataloader")<import("../clients/commerce/types/Simulation").PayloadItem[], import("../clients/commerce/types/Simulation").Simulation, import("../clients/commerce/types/Simulation").PayloadItem[]>;
};
