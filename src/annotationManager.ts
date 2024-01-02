import AbapRepoManager from "./repositories/abapRepoManager";
import AnnotationsCacheManager from "./cache/annotationsCacheManager";
import BaseAppManager from "./baseAppManager";
import I18nManager from "./i18nManager";
import { IConfiguration } from "./model/types";
import XmlUtil from "./util/xmlUtil";
import { posix as path } from "path";

const I18N_DEFAULT_PATH = "i18n/annotations";
const I18N_DEFAULT_MODEL_NAME = "@i18n";
const SAPUI5 = "sap.ui5";
const SAPAPP = "sap.app";

interface ILanguageXmlContent {
    language: string;
    xml: string;
}

export interface IAnnotationFiles {
    annotationName: string
    annotationFileName: string;
}

const log = require("@ui5/logger").getLogger("@ui5/task-adaptation::AnnotationManager");

export default class AnnotationManager {

    private abapRepoManager: AbapRepoManager;
    private configuration: IConfiguration;

    constructor(configuration: IConfiguration, abapRepoManager: AbapRepoManager) {
        this.configuration = configuration;
        this.abapRepoManager = abapRepoManager;
    }

    public ANNOTATIONS_FOLDER = "annotations";


    async process(renamedBaseAppManifest: any, languages: string[]) {
        const { id } = BaseAppManager.getIdVersion(renamedBaseAppManifest);
        BaseAppManager.validateProperty(id, "sap.app/id");

        const normalisedId = this.normalizeAppVariantId(id);
        //TODO: switch to this after resolving @i18n custom model
        const oDataAnnotations = this.getODataAnnotations(renamedBaseAppManifest);
        const promises = this.downloadAnnotations(oDataAnnotations, languages);

        const modelName = I18N_DEFAULT_MODEL_NAME;//`i18n_a9n_${normalisedId}`;
        const i18nPathName = path.join(I18N_DEFAULT_PATH, normalisedId);

        const annotationFiles = new Map<string, string>();
        const metaInfo = new Array<IAnnotationFiles>();
        const i18nManager = new I18nManager(modelName, id, languages);
        for (const { promisesPerLanguage, annotationName } of promises) {
            const annotationXml = await this.createAnnotationFile(promisesPerLanguage, i18nManager);
            const annotationFileName = `annotations/annotation_${annotationName}.xml`;
            annotationFiles.set(annotationFileName, annotationXml);
            metaInfo.push({ annotationFileName, annotationName });
        }
        if (metaInfo.length > 0) {
            this.updateManifestDataSources(renamedBaseAppManifest, metaInfo);
            if (i18nManager.hasTranslations()) {
                this.updateManifestModel(renamedBaseAppManifest, modelName, i18nPathName);
            }
        }
        
        const i18nFiles = i18nManager.createFiles(i18nPathName);

        return new Map([...annotationFiles, ...i18nFiles]);
    }


    private normalizeAppVariantId(id: string, replaceWith = "") {
        return id.replace(/[.\W]+/gi, replaceWith);
    }


    private async createAnnotationFile(promisesPerLanguage: Promise<ILanguageXmlContent>[], i18nManager: I18nManager): Promise<string> {
        const annotationJsons = new Map<string, any>();
        for (const promise of promisesPerLanguage) {
            const { language, xml } = await promise;
            annotationJsons.set(language, XmlUtil.xmlToJson(xml));
        }
        const annotationJson = i18nManager.populateTranslations(annotationJsons);
        return XmlUtil.jsonToXml(annotationJson.json);
    }


    private downloadAnnotations(annotations: any, languages: string[]) {
        return [...annotations].map(([name, { uri }]) => ({
            promisesPerLanguage: languages.map(language => this.downloadAnnotation(uri, name, language)),
            annotationName: name
        }));
    }


    private updateManifestModel(renamedBaseAppManifest: any, modelName: string, i18nPathName: string) {
        const uri = `${i18nPathName}/i18n.properties`;
        this.enhanceManifestModel(renamedBaseAppManifest, modelName, uri);
        //TODO: switch to this after resolving @i18n custom model
        //this.createManifestModel(renamedBaseAppManifest, modelName, uri);
    }


    private updateManifestDataSources(renamedBaseAppManifest: any, metaInfo: IAnnotationFiles[]) {
        const dataSources = renamedBaseAppManifest[SAPAPP]?.dataSources;
        for (const { annotationName, annotationFileName } of metaInfo) {
            dataSources[annotationName].uri = annotationFileName;
        }
    }


    private createManifestModel(manifest: any, modelName: string, uri?: string) {
        let sapui5 = manifest[SAPUI5] == null ? manifest[SAPUI5] = {} : manifest[SAPUI5];
        if (sapui5.models == null) {
            sapui5.models = {};
        }
        if (sapui5.models[modelName] == null) {
            sapui5.models[modelName] = {};
        }
        sapui5.models[modelName].type = "sap.ui.model.resource.ResourceModel";
        if (uri) {
            sapui5.models[modelName].uri = uri;
        }
        return sapui5.models[modelName];
    }


    private enhanceManifestModel(manifest: any, modelToEnhance: string, bundleUrl: string) {
        let model = manifest[SAPUI5]?.models[modelToEnhance];
        if (model) {
            if (model.settings == null) {
                model.settings = {};
            }
            if (model.settings.enhanceWith == null) {
                model.settings.enhanceWith = [];
            }
            if (model.settings.enhanceWith.every((bundle: any) => bundle.bundleUrl !== bundleUrl)) {
                model.settings.enhanceWith.push({
                    bundleUrl,
                    bundleUrlRelativeTo: "component"
                });
            }
        } else {
            this.createManifestModel(manifest, modelToEnhance, bundleUrl);
        }
    }


    private async downloadAnnotation(uri: string, name: string, language: string): Promise<ILanguageXmlContent> {
        let annotationUri = `https://${this.configuration.destination}.dest${uri}`;
        let cacheFilename = name;
        if (language) {
            annotationUri += `?sap-language=${language}`;
            cacheFilename += `-${language}`;
        }
        const cacheManager = new AnnotationsCacheManager(this.configuration, cacheFilename);
        log.verbose(`Getting annotation '${name}' ${language} by '${annotationUri}'`);
        try {
            let files;
            if (this.configuration.enableAnnotationCache) {
                files = await cacheManager.getFiles(
                    () => this.abapRepoManager.getAnnotationMetadata(annotationUri),
                    () => this.abapRepoManager.downloadAnnotationFile(annotationUri));
            } else {
                files = await this.abapRepoManager.downloadAnnotationFile(annotationUri);
            }
            if (!files || files.size === 0) {
                throw new Error(`No files were fetched for '${name}' by '${annotationUri}'`);
            }
            return { language, xml: [...files][0][1] };
        } catch (error: any) {
            throw new Error(`Failed to fetch annotation '${name}' by '${annotationUri}': ${error.message}`);
        }
    }


    private getODataAnnotations(renamedBaseAppManifest: any) {
        const oDataAnnotations = new Map<string, any>();
        const dataSources = renamedBaseAppManifest[SAPAPP]?.dataSources;
        if (dataSources) {
            for (const key of Object.keys(dataSources)) {
                const annotation = dataSources[key];
                if (annotation?.type === "ODataAnnotation" && annotation?.uri?.startsWith("/")) {
                    oDataAnnotations.set(key, dataSources[key]);
                }
            }
        }
        return oDataAnnotations;
    }
}