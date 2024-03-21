import MetadataJsonUtil, { MetadataInclude } from "./metadataJsonUtil.js";

export default class MetadataJsonReferenceUtil {
    private json: any;
    private aliases: Map<string, string> | null = null;
    private namespaces: Map<string, string> | null = null;

    constructor(json: any) {
        this.json = json;
    }

    aliasToNamespace(target: string) {
        return this.convertReference(this.getAliases()!, target);
    }

    namespaceToAlias(target: string) {
        return this.convertReference(this.getNamespaces()!, target);
    }

    private convertReference(references: Map<string, string>, target: string) {
        for (const alias of references.keys()) {
            target = target.replaceAll(alias + ".", references.get(alias) + ".");
        }
        return target;
    }

    private getAliases() {
        this.initReferences();
        return this.aliases;
    }

    private getNamespaces() {
        this.initReferences();
        return this.namespaces;
    }

    private initReferences(): void {
        if (!this.aliases || !this.namespaces) {
            const references = new Array<MetadataInclude>();
            for (const ref of MetadataJsonUtil.getReferences(this.json)) {
                references.push(...ref.includes);
            }
            references.push(MetadataJsonUtil.getSchemaReference(this.json));
            this.aliases = new Map<string, string>();
            this.namespaces = new Map<string, string>();
            for (const mapping of references) {
                if (mapping.alias && mapping.namespace) {
                    const { alias, namespace } = mapping;
                    this.aliases.set(alias, namespace);
                    this.namespaces.set(namespace, alias);
                }
            }
        }
    }
}
