import I18nManager from "../../i18nManager";
import { IAnnotationDownloadParams } from "./dataSourceOData";
import Language from "../../model/language";
import ServiceRequestor from "../serviceRequestor";
import Transformer from "../transformers/transformer";
import XmlUtil from "../../util/xmlUtil";

export default class DataSource {

    protected name: string;
    private uri: string;
    protected jsonTransformers = new Array<Transformer>();


    constructor(name: string, uri: string) {
        this.name = name;
        this.uri = uri;
    }


    /**
     * Update the json of the dataSources in manifest.json
     */
    updateManifest(_: any) {
        // to be overriden in children
    }


    /**
     * Get the filename under which it should be stored in dist folder
     */
    getFilename(): string {
        return `annotations/annotation_${this.name}.xml`;
    }


    async createAnnotationFile(languages: Language[], i18nManager: I18nManager, serviceRequestor: ServiceRequestor): Promise<{ filename: string, xml: string }> {
        const annotationJsons = this.getPromisesPerLanguage(languages, serviceRequestor);
        const annotationJson = await i18nManager.populateTranslations(annotationJsons);
        const xml = XmlUtil.jsonToXml(await annotationJson.json);
        return {
            filename: this.getFilename(),
            xml
        };
    }


    /**
     * Download the annotation for all configured languages
     * @param languages from configuration
     * @param serviceRequestor will download the annotation for all languages
     */
    private getPromisesPerLanguage(languages: Language[], serviceRequestor: ServiceRequestor): Map<Language, Promise<any>> {
        const promises = new Map<Language, Promise<any>>();
        for (const language of languages) {
            promises.set(
                language,
                this.downloadAnnotation(language, serviceRequestor)
            );
        }
        return promises;
    }


    /**
     * Download annotations and process xml string after it
     */
    async downloadAnnotation(language: Language, serviceRequestor: ServiceRequestor) {
        const languageXmlContent = await serviceRequestor.downloadAnnotation(this.uri, this.name, language);
        if (!languageXmlContent) {
            throw new Error(`Xml is undefined for '${this.uri}', name '${this.name}' and language '${language.sap}'`);
        }
        return this.afterXmlDownload({ xml: languageXmlContent, language, serviceRequestor, uri: this.uri });
    }


    async afterXmlDownload({ xml, language, serviceRequestor, uri }: IAnnotationDownloadParams): Promise<any> {
        let json = XmlUtil.xmlToJson(xml);
        for (const transformer of this.jsonTransformers) {
            json = await transformer.transform({ xml, json, language, serviceRequestor, uri });
        }
        return json;
    }

}
