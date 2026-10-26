import I18nManager from "../../i18nManager.js";
import { IAnnotationDownloadParams } from "./dataSourceOData.js";
import IRepository from "../../repositories/repository.js";
import Language from "../../model/language.js";
import Transformer from "../transformers/transformer.js";
import XmlUtil from "../../util/xmlUtil.js";
import { getLogger } from "@ui5/logger";
import { retryOnError } from "../../util/commonUtil.js";

const log = getLogger("@ui5/task-adaptation::DataSource");

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


    async createAnnotationFile(languages: Language[], i18nManager: I18nManager, repository: IRepository): Promise<{ filename: string, xml: string }> {
        const annotationJsons = this.getPromisesPerLanguage(languages, repository);
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
     * @param repository will download the annotation for all languages
     */
    private getPromisesPerLanguage(languages: Language[], repository: IRepository): Map<Language, Promise<any>> {
        const promises = new Map<Language, Promise<any>>();
        for (const language of languages) {
            promises.set(
                language,
                this.downloadAnnotation(language, repository)
            );
        }
        return promises;
    }


    /**
     * Download annotations and process xml string after it
     */
    async downloadAnnotation(language: Language, repository: IRepository) {
        const xml = await this.fetchAnnotation(this.uri, language, repository);
        return this.afterXmlDownload({ xml, language, repository, uri: this.uri });
    }


    //@ts-ignore tsx (esbuild) is not yet implemented the new decorators, but
    //old decorators are already subject of compiler error, but it works. So we
    //wait till esbuild implement it correctly.
    @retryOnError(1)
    async fetchAnnotation(uri: string, language: Language, repository: IRepository): Promise<string> {
        const languageUri = `${uri}?sap-language=${language.sap}`;
        log.verbose(`Getting annotation '${this.name}' ${language} by '${languageUri}'`);
        const xml = await repository.downloadAnnotationFile(languageUri);
        if (!xml) {
            throw new Error(`No files were fetched for '${this.name}' by '${languageUri}'`);
        }
        return xml;
    }


    async afterXmlDownload({ xml, language, repository, uri }: IAnnotationDownloadParams): Promise<any> {
        let json = XmlUtil.xmlToJson(xml);
        for (const transformer of this.jsonTransformers) {
            json = await transformer.transform({ xml, json, language, repository, uri });
        }
        return json;
    }

}
