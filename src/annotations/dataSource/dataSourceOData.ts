import ConvertV2ToV4 from "../transformers/convertV2ToV4.js";
import DataSource from "./dataSource.js";
import Language from "../../model/language.js";
import MakeAnnotationNamespaceUnique from "../transformers/makeAnnotationNamespaceUnique.js";
import RemoveAllSchemaNodesExceptAnnotations from "../transformers/removeAllSchemaNodesExceptAnnotations.js";
import ServiceRequestor from "../serviceRequestor.js";
import TraverseReferences from "../transformers/traverseReferences.js";
import { getUniqueName } from "../../util/commonUtil.js";

export interface IAnnotationDownloadParams {
    uri: string;
    xml: string;
    language: Language;
    serviceRequestor: ServiceRequestor;
}

export default class DataSourceOData extends DataSource {

    private dataSourceJson: any


    constructor(name: string, uri: string, dataSourceJson: any) {
        super(name, uri);
        this.dataSourceJson = dataSourceJson;
        this.jsonTransformers = [
            new TraverseReferences(),
            new ConvertV2ToV4(),
            new RemoveAllSchemaNodesExceptAnnotations(),
            new MakeAnnotationNamespaceUnique()
        ];
    }


    updateManifest(manifestDataSources: any) {
        this.getSettings().ignoreAnnotationsFromMetadata = true;
        this.addNewODataAnnotation(manifestDataSources);
    }


    addNewODataAnnotation(manifestDataSources: any) {
        const newAnnotationNameTemplate = `annotation_${this.name}`;
        let newAnnotationName = getUniqueName(Object.keys(manifestDataSources), newAnnotationNameTemplate);
        this.getAnnotations().unshift(newAnnotationName);
        manifestDataSources[newAnnotationName] = {
            type: "ODataAnnotation",
            uri: this.getFilename()
        }
    }


    private getSettings() {
        if (this.dataSourceJson.settings == null) {
            this.dataSourceJson.settings = {};
        }
        return this.dataSourceJson.settings;
    }


    getAnnotations(): string[] {
        if (this.getSettings().annotations == null) {
            this.getSettings().annotations = [];
        }
        return this.getSettings().annotations;
    }
}
