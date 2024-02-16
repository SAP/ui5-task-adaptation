export default class MetadataJsonUtil {

    static mapAnnotationsPerTarget(json: any): Map<string, IJsonIndex> {
        const annotations = Array.isArray(json) ? json : this.getAnnotations(json);
        return new Map(annotations.map((json: any, index: number) => [json?._attributes?.Target as string, { json, index }]));
    }

    static getVersion(json: any) {
        return this.getEdmx(json)?._attributes?.Version;
    }

    static getAnnotations(json: any) {
        return this.toArrayReadOnly(this.getSchemaNode(json)?.Annotations);
    }

    static setAnnotations(json: any, annotations: any[]) {
        const schema = this.getSchemaNode(json);
        annotations.forEach(annotation => annotation._attributes.xmlns = "http://docs.oasis-open.org/odata/ns/edm");
        schema.Annotations = annotations;
    }

    static getSchemaNode(json: any) {
        return this.getDataServices(json)?.Schema;
    }

    static getSchemaReference(json: any) {
        return MetadataInclude.fromJson(this.getDataServices(json)?.Schema?._attributes);
    }

    static getEdmx(json: any) {
        return json["edmx:Edmx"];
    }

    static getDataServices(json: any) {
        return this.getEdmx(json)["edmx:DataServices"];
    }

    static getReferences(json: any): MetadataReference[] {
        const referenceNode = this.toArrayReadOnly(this.getEdmx(json)["edmx:Reference"]);
        return referenceNode.map(ref => new MetadataReference(ref));
    }

    static toArrayReadOnly(json: any) {
        return Array.isArray(json) ? json : [json];
    }

    static toArrayTransform(json: any, property: string) {
        if (!Array.isArray(json[property])) {
            json[property] = [json[property]];
        }
    }

}

export class MetadataReference {
    uri: string;
    includes = new Array<MetadataInclude>();

    constructor(referenceJson: any) {
        this.uri = referenceJson._attributes.Uri;
        for (const include of MetadataJsonUtil.toArrayReadOnly(referenceJson["edmx:Include"])) {
            this.includes.push(MetadataInclude.fromJson(include));
        }
    }

    getAlias(namespace: string): string | undefined {
        const include = this.includes.find(include => include.namespace === namespace);
        return include?.alias;
    }
}

export class MetadataInclude {
    namespace: string;
    alias: string;

    constructor(alias: string, namespace: string) {
        this.alias = alias;
        this.namespace = namespace;
    }

    equals(other: MetadataInclude) {
        return this.alias === other.alias && this.namespace === other.namespace;
    }

    static fromJson(json: any) {
        return new MetadataInclude(json?._attributes?.Alias, json?._attributes?.Namespace);
    }
}


export interface IJsonIndex {
    json: any;
    index: number;
}