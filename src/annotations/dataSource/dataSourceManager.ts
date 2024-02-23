import DataSource from "./dataSource";
import DataSourceOData from "./dataSourceOData";
import DataSourceODataAnnotation from "./dataSourceODataAnnotation";
import DataSourceODataAnnotationBeta from "./dataSourceODataAnnotationBeta";
import I18nManager from "../../i18nManager";
import { IConfiguration } from "../../model/types";
import Language from "../../model/language";
import ServiceRequestor from "../serviceRequestor";
import { posix as path } from "path";

export default class DataSourceManager {

    private dataSources = new Array<DataSource>();


    /**
     * Parses dataSources from manifest.json.
     * @param dataSourcesJson manifest.json/sap.app/dataSources node
     */
    addDataSources(dataSourcesJson: any, config: IConfiguration): void {
        if (!dataSourcesJson) {
            return;
        }
        const odataAnnotationMap = new Map<string, string>();
        if (config.enableBetaFeatures) {
            // Loop over OData first to collect linked annotation names
            for (const [name, dataSource] of Object.entries<any>(dataSourcesJson)) {
                if (dataSource.uri?.startsWith("/") && dataSource.type === "OData") {
                    const uri = path.normalize(dataSource.uri + "/$metadata");
                    const odata = new DataSourceOData(name, uri, dataSource);
                    odata.getAnnotations().forEach(annotation => odataAnnotationMap.set(annotation, uri))
                    this.dataSources.push(odata);
                }
            }
        }
        // If ODataAnnotation is in OData annotations, pass metadata url to it
        for (const [name, dataSource] of Object.entries<any>(dataSourcesJson)) {
            const uri = dataSource.uri;
            const metadataUrl = odataAnnotationMap.get(name);
            if (uri?.startsWith("/") && dataSource.type === "ODataAnnotation") {
                if (config.enableBetaFeatures) {
                    this.dataSources.push(new DataSourceODataAnnotationBeta(name, uri, dataSource, metadataUrl));
                } else {
                    this.dataSources.push(new DataSourceODataAnnotation(name, uri, dataSource));
                }
            }
        }
        for (const dataSource of this.dataSources) {
            dataSource.updateManifest(dataSourcesJson);
        }
    }

    async createAnnotationFiles(languages: Language[], i18nManager: I18nManager, serviceRequestor: ServiceRequestor) {
        const annotationFiles = new Map<string, string>();
        for (const dataSource of this.dataSources) {
            const { filename, xml } = await dataSource.createAnnotationFile(languages, i18nManager, serviceRequestor);
            annotationFiles.set(filename, xml);
        }
        return annotationFiles;
    }
}
