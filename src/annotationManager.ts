import AbapRepoManager from "./repositories/abapRepoManager";
import BaseAppManager from "./baseAppManager";
import I18nManager from "./i18nManager";
import { IConfiguration } from "./model/types";
import ODataV2Model from "./annotations/oDataV2Model";
import ServiceRequestor from "./annotations/serviceRequestor";
import XmlUtil from "./util/xmlUtil";
import { posix as path } from "path";
import Language from "./model/language";

const I18N_DEFAULT_PATH = "i18n/annotations";
const I18N_DEFAULT_MODEL_NAME = "@i18n";
const SAPUI5 = "sap.ui5";
const SAPAPP = "sap.app";


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
        const { id } = BaseAppManager.getIdVersion(renamedBaseAppManifest);
        BaseAppManager.validateProperty(id, "sap.app/id");

        const normalisedId = this.normalizeAppVariantId(id);

        //TODO: switch to this after resolving @i18n custom model
        const modelName = I18N_DEFAULT_MODEL_NAME;//`i18n_a9n_${normalisedId}`;
        const i18nPathName = path.join(I18N_DEFAULT_PATH, normalisedId);
        const annotationFiles = new Map<string, string>();
        const metaInfo = new Array<IAnnotationFiles>();
        const i18nManager = new I18nManager(modelName, id, languages);

        const oDataModels = this.createODataModels(renamedBaseAppManifest);
        for (const oDataModel of oDataModels) {
            for (const { annotationJsons, annotationName } of oDataModel.getAnnotationJsons(languages)) {
                const annotationXml = await this.createAnnotationFile(await annotationJsons, i18nManager);
                const annotationFileName = `annotations/annotation_${annotationName}.xml`;
                annotationFiles.set(annotationFileName, annotationXml);
                metaInfo.push({ annotationFileName, annotationName });
            }
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


    private async createAnnotationFile(annotationJsons: Map<Language, any>, i18nManager: I18nManager): Promise<string> {
        const annotationJson = i18nManager.populateTranslations(annotationJsons);
        return XmlUtil.jsonToXml(annotationJson.json);
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


    private createODataModels(renamedBaseAppManifest: any) {
        const serviceRequestor = new ServiceRequestor(this.configuration, this.abapRepoManager);
        const oDataModels = [
            new ODataV2Model(serviceRequestor)
        ];
        const dataSources = renamedBaseAppManifest["sap.app"]?.dataSources;
        if (dataSources) {
            for (const name of Object.keys(dataSources)) {
                oDataModels.forEach(model => model.addDataSource(dataSources[name], name));
            }
        }
        return oDataModels;
    }
}