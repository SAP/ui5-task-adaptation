import AbapRepoManager from "../repositories/abapRepoManager";
import AnnotationsCacheManager from "../cache/annotationsCacheManager";
import { IConfiguration } from "../model/types";
import Language from "../model/language";

const log = require("@ui5/logger").getLogger("@ui5/task-adaptation::ServiceRequestor");

export interface ILanguageXmlContent {
    language: Language;
    xml: string;
}

export interface ILanguageJsonContent {
    language: Language;
    json: any;
}

export default class ServiceRequestor {
    private abapRepoManager: AbapRepoManager;
    private configuration: IConfiguration;

    constructor(configuration: IConfiguration, abapRepoManager: AbapRepoManager) {
        this.abapRepoManager = abapRepoManager;
        this.configuration = configuration;
    }

    async downloadAnnotation(uri: string, name: string, language: Language): Promise<ILanguageXmlContent> {
        if (language.sap) {
            uri += `?sap-language=${language.sap}`;
            name += `-${language.sap}`;
        }
        const cacheManager = new AnnotationsCacheManager(this.configuration, name);
        log.verbose(`Getting annotation '${name}' ${language.sap} by '${uri}'`);
        try {
            let files;
            if (this.configuration.enableAnnotationCache) {
                files = await cacheManager.getFiles(
                    () => this.abapRepoManager.getAnnotationMetadata(uri),
                    () => this.abapRepoManager.downloadAnnotationFile(uri));
            } else {
                files = await this.abapRepoManager.downloadAnnotationFile(uri);
            }
            if (!files || files.size === 0) {
                throw new Error(`No files were fetched for '${name}' by '${uri}'`);
            }
            return { language, xml: [...files][0][1] };
        } catch (error: any) {
            throw new Error(`Failed to fetch annotation by '${uri}': ${error.message}`);
        }
    }
}
