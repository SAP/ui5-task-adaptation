import DataSource from "./dataSource";
import TraverseReferences from "../transformers/traverseReferences";

export default class DataSourceODataAnnotation extends DataSource {

    private dataSourceJson: any;

    constructor(name: string, uri: string, dataSourceJson: any, metadataUrl: string | undefined) {
        super(name, uri);
        this.dataSourceJson = dataSourceJson;
        this.jsonTransformers = [
            new TraverseReferences(metadataUrl)
        ];
    }

    updateManifest() {
        this.dataSourceJson.uri = this.getFilename();
    }

}
