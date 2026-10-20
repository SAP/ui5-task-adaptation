import BaseApp from "../baseApp.js";

/**
 * Fluent builder for the reference map (old id → adaptation project id) used to
 * rename files. Chain `addReferences` and finish with `build`.
 */
export default class ReferencesBuilder {
    private readonly references = new Map<string, string>();

    /**
     * Adds the references derived from the app variant id hierarchy stored in
     * the given files' manifest.
     */
    addReferences(files: ReadonlyMap<string, Buffer>, adaptationProjectId: string): this {
        const hierarchy = BaseApp.getAppVariantHierarchy(files);
        const references = this.getReferences(hierarchy, adaptationProjectId);
        references.forEach((value, key) => this.references.set(key, value));
        return this;
    }


    addReference(from: string, to: string): this {
        this.references.set(from, to);
        return this;
    }


    build(): Map<string, string> {
        return this.references;
    }


    private getReferences(appVariantIdHierarchy: string[], adaptationProjectId: string): Map<string, string> {
        const references = new Map<string, string>();
        for (const appVariantId of appVariantIdHierarchy) {
            if (appVariantId !== adaptationProjectId && !references.has(appVariantId)) {
                references.set(appVariantId, adaptationProjectId);
            }
        }
        return references;
    }
}
