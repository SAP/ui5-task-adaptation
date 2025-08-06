import MetadataJsonReferenceUtil from "../../../src/annotations/converter/metadataJsonReferenceUtil.js";
import { traverse } from "../../../src/util/commonUtil.js";

export default class AnnotationUtil {

    /**
     * Prepares json for test to compare with the output of the ui5 json converter.
     * @param json internal json converted from xml
     * @returns
     */
    static normalizeToCompareWithUI5(json: any) {
        const metadataJsonUtil = new MetadataJsonReferenceUtil(json);
        const clone = structuredClone(json);
        traverse(clone, [], (json: any, key: string | number, paths: string[]) => {
            // We don't convert _text properties to namespaces except it is
            // under AnnotationPath.
            if (key === "_text" && paths[paths.length - 2] !== "AnnotationPath") {
                return;
            }
            // Usually boolean properties have different equal represantation e.g. for value=true:
            // 1. <PropertyValue Property="Insertable" Bool="true" /> or just
            // 2. <PropertyValue Property="Insertable" />. But in rare cases it is
            // 3. <PropertyValue Property="Insertable"><Bool>true</Bool></PropertyValue>
            // and for value=false
            // 4. <PropertyValue Property="Insertable" Bool="false" /> or just
            // 5. <PropertyValue Property="Insertable"><Bool>false</Bool></PropertyValue>
            // so we normalize it to 2..
            // TODO Should suppress _comment nodes
            // FIXME doesn't work if node is nested e.g. Record > PropertyValue
            // FIXME Doesn't work if Bool is subnode 3. or 5.
            if (key === "Bool" && json[key] && json[key] !== "false" && paths[paths.length - 3] === "Annotation" ) {
                delete json[key];
            } else if (typeof json[key] === "string") {
                json[key] = metadataJsonUtil.aliasToNamespace(json[key]);
            }
        });
        return clone;
    }

}