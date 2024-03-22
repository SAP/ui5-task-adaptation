import Transformer, { TransformerInput } from "./transformer.js";

import MetadataJsonUtil from "../converter/metadataJsonUtil.js";

export default class RemoveAllSchemaNodesExceptAnnotations implements Transformer {
    transform({ json }: TransformerInput): any {
        const schema = MetadataJsonUtil.getSchemaNode(json);
        for (const key of Object.keys(schema)) {
            if (key !== "_attributes" && key !== "Annotations") {
                delete schema[key];
            }
        }
        return json;
        // TODO: remove also references not used in annotations
    }
}