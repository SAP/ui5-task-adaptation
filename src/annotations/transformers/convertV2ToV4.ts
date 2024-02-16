import Transformer, { TransformerInput } from "./transformer";

import MetadataJsonUtil from "../converter/metadataJsonUtil";
import UI5JsonConverter from "../converter/ui5JsonConverter";
import UI5XmlConverter from "../converter/ui5XmlConverter";

export default class ConvertV2ToV4 implements Transformer {
    transform({ json, xml }: TransformerInput): any {
        if (MetadataJsonUtil.getVersion(json) !== "4.0") {
            const annotationsV4 = UI5JsonConverter.convertAnnotations(UI5XmlConverter.convertV2(xml));
            MetadataJsonUtil.setAnnotations(json, annotationsV4);
        }
        return json;
    }
}