export interface Adapter {
    adapt(files: ReadonlyMap<string, string>, appVariantFiles: ReadonlyMap<string, string>): Promise<ReadonlyMap<string, string>>;
}

export interface Mutator {
    mutate(files: Map<string, string>, appVariantFiles: ReadonlyMap<string, string>): Promise<void>;
}

export class BaseAdapter implements Adapter {
    protected mutators: Mutator[] = [];

    async adapt(files: ReadonlyMap<string, string>, appVariantFiles: ReadonlyMap<string, string>): Promise<ReadonlyMap<string, string>> {
        const filesCopy = new Map(files);
        for (const mutator of this.mutators) {
            await mutator.mutate(filesCopy, appVariantFiles);
        }
        return filesCopy;
    }
}
