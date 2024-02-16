export default class UI5MetadataJsonUtil {

    static getAnnotationsNode(json: any) {
        for (const key of Object.keys(json)) {
            if (json[key].$kind === "Schema") {
                return json[key].$Annotations;
            }
        }
    }

}