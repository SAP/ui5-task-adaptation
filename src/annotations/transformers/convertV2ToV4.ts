import Transformer, { TransformerInput } from "./transformer.js";

import MetadataJsonUtil from "../converter/metadataJsonUtil.js";
import UI5JsonConverter from "../converter/ui5JsonConverter.js";
import UI5XmlConverter from "../converter/ui5XmlConverter.js";

export default class ConvertV2ToV4 implements Transformer {
    transform({ json, xml }: TransformerInput): any {
        if (MetadataJsonUtil.getVersion(json) !== "4.0") {
            const annotationsV4 = UI5JsonConverter.convertAnnotations(UI5XmlConverter.convertV2(xml));
            MetadataJsonUtil.setAnnotations(json, annotationsV4);
        }
        return json;
    }
}