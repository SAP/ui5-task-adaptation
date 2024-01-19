import ODataModel from "./oDataModel";

export default class ODataV2Model extends ODataModel {

    addDataSource({ uri, type }: any, name: string): void {
        if (uri?.startsWith("/") &&
            type === "ODataAnnotation") {
            this.oDataAnnotations.set(name, uri);
        }
    }

}