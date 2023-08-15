import * as convert from "xml-js";
import * as path from "path";

import AbapRepoManager from "./repositories/abapRepoManager";
import AnnotationsCacheManager from "./cache/annotationsCacheManager";
import BaseAppManager from "./baseAppManager";
import { IConfiguration } from "./model/types";
import { diff } from "json-diff";
import { inspect } from "util";

const { ResourceBundle } = require("../dist/bundle-resourceBundle");
const I18N_DEFAULT_PATH = "i18n/annotations";
const I18N_DEFAULT_MODEL_NAME = "@i18n";
const SAPUI5 = "sap.ui5";
const SAPAPP = "sap.app";

interface ILanguageContent {
    language: string;
    xml: string;
}

export interface IAnnotationFiles {
    annotationName: string
    annotationFileName: string;
}


const XML_OPTIONS = { compact: true, spaces: 4 };

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
        const { id } = BaseAppManager.getManifestInfo(renamedBaseAppManifest);
        BaseAppManager.validateProperty(id, "sap.app/id");

        const normalisedId = this.normalizeAppVariantId(id);
        //TODO: switch to this after resolving @i18n custom model
        const oDataAnnotations = this.getODataAnnotations(renamedBaseAppManifest);
        const promises = this.downloadAnnotations(oDataAnnotations, languages);

        const modelName = I18N_DEFAULT_MODEL_NAME;//`i18n_a9n_${normalisedId}`;
        const i18nPathName = path.join(I18N_DEFAULT_PATH, normalisedId);

        const keys = new Array<string>();
        const propertiesPerLanguage = new Map<string, string[]>();
        const annotationFiles = new Map<string, string>();
        const metaInfo = new Array<IAnnotationFiles>();
        for (const { promisesPerLanguage, annotationName } of promises) {
            const annotationXml = await this.createAnnotationFile(promisesPerLanguage, keys, modelName, propertiesPerLanguage, id);
            const annotationFileName = `annotations/annotation_${annotationName}.xml`;
            annotationFiles.set(annotationFileName, annotationXml);
            metaInfo.push({ annotationFileName, annotationName });
        }

        if (metaInfo.length > 0) {
            this.updateManifest(renamedBaseAppManifest, metaInfo, modelName, i18nPathName);
        }

        const i18nFiles = this.createI18nFiles(propertiesPerLanguage, i18nPathName);

        return new Map([...annotationFiles, ...i18nFiles]);
    }


    private createI18nFiles(propertiesPerLanguage: Map<string, string[]>, i18nPathName: string) {
        const files = new Map<string, string>();
        propertiesPerLanguage.forEach((i18nLines, language) => {
            i18nLines.sort();
            let filename = "i18n";
            const normalisedLanguage = this.getNormalisedLanguage(language);
            if (normalisedLanguage) {
                filename += "_" + normalisedLanguage;
            }
            const filepath = path.join(i18nPathName, filename + ".properties");
            files.set(filepath, i18nLines.join("\n"));
        });
        return files;
    }


    private normalizeAppVariantId(id: string, replaceWith = "") {
        return id.replace(/[.\W]+/gi, replaceWith);
    }


    private async createAnnotationFile(promisesPerLanguage: Promise<ILanguageContent>[],
        keys: string[], modelName: string, propertiesPerLanguage: Map<string, string[]>, appVariantId: string): Promise<string> {
        const annotationJsons = new Map<string, any>();
        for (const promise of promisesPerLanguage) {
            const { language, xml } = await promise;
            annotationJsons.set(language, JSON.parse(convert.xml2json(xml, XML_OPTIONS)));
        }

        const paths = this.getDiffJsonPaths([...annotationJsons.values()]);
        const { annotationJson, languageI18nContentMap } = this.getAdaptedAnnotation(paths, keys, annotationJsons, modelName, appVariantId);

        languageI18nContentMap.forEach((i18nLines, language) => {
            const properties = propertiesPerLanguage.get(language);
            if (properties) {
                properties.push(...i18nLines);
            } else {
                propertiesPerLanguage.set(language, i18nLines);
            }
        });

        return convert.json2xml(annotationJson, XML_OPTIONS);
    }


    private getNormalisedLanguage(language: string): string | undefined {
        const normalisedLanguages = ResourceBundle._getFallbackLocales(language);
        if (normalisedLanguages?.length > 0 && normalisedLanguages[0] != null && normalisedLanguages[0].length > 0) {
            return normalisedLanguages[0].toLowerCase();
        }
    }


    private getAdaptedAnnotation(paths: string[], keys: string[],
        annotationJsons: Map<string, any>, modelName: string, appVariantId: string) {
        const pathKeyMap = new Map<string, string>();
        const languageI18nContentMap = new Map<string, string[]>();
        for (const [language, json] of [...annotationJsons]) {
            const lines = [];
            for (const path of paths) {
                const { subject, property } = AnnotationManager.traverseJson(json, path);
                const value = subject[property];
                const key = appVariantId + "_" + this.getUniqueKeyForPath(pathKeyMap, path, keys, value);
                lines.push(key + "=" + value);
                subject[property] = `{${modelName}>${key}}`;
            }
            if (lines.length > 0) {
                languageI18nContentMap.set(language, lines);
            }
        }
        return { annotationJson: [...annotationJsons][0][1], languageI18nContentMap };
    }


    private getUniqueKeyForPath(pathKeyMap: Map<string, string>, path: string, keys: string[], value: string) {
        if (pathKeyMap.has(path)) {
            return pathKeyMap.get(path);
        }
        const propertyName = value.replace(/\W/gi, "_").toUpperCase();
        let suffix = "";
        while (keys.includes(propertyName + suffix)) {
            suffix = suffix === "" ? "0" : (parseInt(suffix) + 1).toString();
        }
        const key = propertyName + suffix;
        pathKeyMap.set(path, key)
        keys.push(key);
        return key;
    }


    private downloadAnnotations(annotations: any, languages: string[]) {
        return [...annotations].map(([name, { uri }]) => ({
            promisesPerLanguage: languages.map(language => this.downloadAnnotation(uri, name, language)),
            annotationName: name
        }));
    }


    private updateManifest(renamedBaseAppManifest: any, metaInfo: IAnnotationFiles[], modelName: string, i18nPathName: string) {
        const uri = `${i18nPathName}/i18n.properties`;
        this.enhanceManifestModel(renamedBaseAppManifest, modelName, uri);
        //TODO: switch to this after resolving @i18n custom model
        //this.createManifestModel(renamedBaseAppManifest, modelName, uri);
        this.updateManifestDataSources(renamedBaseAppManifest, metaInfo);
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


    private async downloadAnnotation(uri: string, name: string, language: string): Promise<ILanguageContent> {
        let annotationUri = `https://${this.configuration.destination}.dest${uri}`;
        let cacheFilename = name;
        if (language) {
            annotationUri += `?sap-language=${language}`;
            cacheFilename += `-${language}`;
        }
        const cacheManager = new AnnotationsCacheManager(this.configuration, cacheFilename);
        log.verbose(`Getting annotation '${name}' ${language} by '${annotationUri}'`);
        try {
            const files = await cacheManager.getFiles(
                () => this.abapRepoManager.getAnnotationMetadata(annotationUri),
                () => this.abapRepoManager.downloadAnnotationFile(annotationUri));
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


    static traverseJson(obj: any, path: string) {
        const checkArrayIndex = (part: string) => {
            if (Array.isArray(subject)) {
                const item = parseInt(part);
                if (isNaN(item)) {
                    throw new Error(`Array index '${part}' is not a number in path '${path}' for ${json}`);
                }
            }
        }

        const json = inspect(obj, true, 100, false);
        const pathParts = path.split("/");
        if (path.endsWith("/")) {
            pathParts.pop();
        }
        let property = pathParts.pop()!;
        let subject = obj;
        for (const part of pathParts) {
            let item: any = part;
            checkArrayIndex(part);
            subject = subject[item];
            if (subject == null) {
                throw new Error(`Property '${item}' is undefined in path '${path}' for ${json}`);
            }
        }
        checkArrayIndex(property);
        if (subject[property] == null) {
            throw new Error(`Target property '${property}' is undefined in path '${path}' for ${json}`);
        }
        return { subject, property };

    }


    private getDiffJsonPaths(jsons: string[]): string[] {
        const paths = new Set<any>();
        if (jsons.length > 1) {
            for (let j = 1; j < jsons.length; j++) {
                const diffResult = diff(jsons[0], jsons[j], { full: false, sort: false });
                // if diffResult is undefined -> jsons are the same
                if (diffResult) {
                    for (const path of this.traverseDiff(diffResult)) {
                        paths.add(path);
                    }
                }
            }
        }
        return [...paths];
    }


    private traverseDiff(obj: any, path: string = ""): string[] {
        const branches = [];
        if (Array.isArray(obj)) {
            for (let i = 0; i < obj.length; i++) {
                const item = obj[i];
                if (item[0] == "~") {
                    branches.push(...this.traverseDiff(item[1], path + `${i}/`));
                }
            }
        } else {
            for (const key of Object.keys(obj)) {
                if (key == "__old" || key == "__new") {
                    branches.push(path);
                } else {
                    branches.push(...this.traverseDiff(obj[key], path + `${key}/`));
                }
            }
        }
        return branches;
    }
}