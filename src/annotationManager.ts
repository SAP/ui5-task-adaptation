import AbapRepoManager from "./repositories/abapRepoManager.js";
import DataSourceManager from "./annotations/dataSource/dataSourceManager.js";
import I18nManager from "./i18nManager.js";
import { IConfiguration } from "./model/types.js";
import Language from "./model/language.js";
import ServiceRequestor from "./annotations/serviceRequestor.js";
import { posix as path } from "path";

const I18N_DEFAULT_PATH = "i18n/annotations";
const I18N_DEFAULT_MODEL_NAME = "@i18n";
const SAPUI5 = "sap.ui5";


export interface IAnnotationFiles {
    annotationName: string
    annotationFileName: string;
}

export default class AnnotationManager {

    private abapRepoManager: AbapRepoManager;
    private configuration: IConfiguration;

    constructor(configuration: IConfiguration, abapRepoManager: AbapRepoManager) {
        this.configuration = configuration;
        this.abapRepoManager = abapRepoManager;
    }

    public ANNOTATIONS_FOLDER = "annotations";


    async process(renamedBaseAppManifest: any, languages: Language[]) {
        const { id } = renamedBaseAppManifest["sap.app"];
        const normalisedId = this.normalizeAppVariantId(id);

        //TODO: switch to this after resolving @i18n custom model
        const modelName = I18N_DEFAULT_MODEL_NAME;//`i18n_a9n_${normalisedId}`;
        const i18nPathName = path.join(I18N_DEFAULT_PATH, normalisedId);
        const i18nManager = new I18nManager(modelName, id, languages);
        const serviceRequestor = new ServiceRequestor(this.configuration, this.abapRepoManager);

        const dataSourceManager = new DataSourceManager();
        dataSourceManager.addDataSources(renamedBaseAppManifest["sap.app"]?.dataSources);
        const annotationFiles = await dataSourceManager.createAnnotationFiles(languages, i18nManager, serviceRequestor);
        const i18nFiles = i18nManager.createFiles(i18nPathName);

        if (i18nManager.hasTranslations()) {
            this.updateManifestModel(renamedBaseAppManifest, modelName, i18nPathName);
        }

        return new Map([...annotationFiles, ...i18nFiles]);
    }


    private normalizeAppVariantId(id: string, replaceWith = "") {
        return id.replace(/[.\W]+/gi, replaceWith);
    }


    private updateManifestModel(renamedBaseAppManifest: any, modelName: string, i18nPathName: string) {
        const uri = `${i18nPathName}/i18n.properties`;
        this.enhanceManifestModel(renamedBaseAppManifest, modelName, uri);
        //TODO: switch to this after resolving @i18n custom model
        //this.createManifestModel(renamedBaseAppManifest, modelName, uri);
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
}