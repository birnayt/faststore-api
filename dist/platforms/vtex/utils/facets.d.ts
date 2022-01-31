export interface SelectedFacet {
    key: string;
    value: string;
}
/**
 * Transform facets from the store to VTEX platform facets.
 * For instance, the channel in Store becames trade-policy in VTEX's realm
 * */
export declare const transformSelectedFacet: ({ key, value }: SelectedFacet) => {
    key: string;
    value: string;
};
