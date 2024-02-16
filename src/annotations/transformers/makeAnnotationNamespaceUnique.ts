import Transformer, { TransformerInput } from "./transformer";

import MetadataJsonUtil from "../converter/metadataJsonUtil";
import crc16 from "crc/crc16";

export default class MakeAnnotationNamespaceUnique implements Transformer {
    transform({ json, uri }: TransformerInput) {

        const uniquePart = crc16(uri).toString(16);

        // First add current schema as reference
        const schema = MetadataJsonUtil.getSchemaNode(json);
        const references = this.getReferences(json);
        references.push(this.createReference(schema, uri));

        // Then rename the namespace/alias
        schema._attributes.Namespace += "." + uniquePart;
        delete schema._attributes["Alias"];
        return json;
    }

    private createReference(schema: any, uri: string) {
        const attributes: any = {
            Namespace: schema._attributes.Namespace
        };
        if (schema._attributes.Alias) {
            attributes.Alias = schema._attributes.Alias;
        };
        return {
            _attributes: {
                Uri: uri
            },
            "edmx:Include": {
                _attributes: attributes
            }
        };
    }

    private getReferences(json: any) {
        const REFERENCE_NODE_NAME = "edmx:Reference";
        const references = MetadataJsonUtil.getEdmx(json)[REFERENCE_NODE_NAME];
        if (!Array.isArray(references)) {
            MetadataJsonUtil.getEdmx(json)[REFERENCE_NODE_NAME] = [references];
        }
        return MetadataJsonUtil.getEdmx(json)[REFERENCE_NODE_NAME];
    }
}
