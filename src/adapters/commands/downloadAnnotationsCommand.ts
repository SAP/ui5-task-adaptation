import { AdaptCommand } from "./command.js";
import { stringToBuffer, bufferToJson } from "../../util/commonUtil.js";
import DataSourceManager from "../../annotations/dataSource/dataSourceManager.js";
import I18nManager from "../../i18nManager.js";
import { IConfiguration } from "../../model/types.js";
import Language from "../../model/language.js";
import ServiceRequestor from "../../annotations/serviceRequestor.js";
import { posix as path } from "path";
import IRepository from "../../repositories/repository.js";

const I18N_DEFAULT_PATH = "i18n/annotations";
const I18N_DEFAULT_MODEL_NAME = "@i18n";
const SAPUI5 = "sap.ui5";

export default class DownloadAnnotationsCommand extends AdaptCommand {
    constructor(
        private appVariantId: string,
        private prefix: string,
        private configuration: IConfiguration,
        private repository: IRepository,
    ) {
        super();
    }

    accept = (filename: string) => filename === "manifest.json";

    async execute(files: Map<string, Buffer>, filename: string): Promise<void> {
        const baseAppManifest = bufferToJson(files.get(filename)!);
        const newFiles = await this.process(baseAppManifest);
        newFiles.forEach((value, key) => files.set(key, stringToBuffer(value)));
        files.set(filename, stringToBuffer(JSON.stringify(baseAppManifest)));
    }

    private async process(baseAppManifest: any): Promise<Map<string, string>> {
        const languages = Language.create(this.configuration.languages);
        //TODO: switch to this after resolving @i18n custom model
        const modelName = I18N_DEFAULT_MODEL_NAME;//`i18n_a9n_${normalisedId}`;
        const i18nPathName = path.join(this.prefix, I18N_DEFAULT_PATH);
        const i18nManager = new I18nManager(modelName, this.appVariantId, languages);
        const serviceRequestor = new ServiceRequestor(this.repository);

        const dataSourceManager = new DataSourceManager();
        await dataSourceManager.addDataSources(baseAppManifest["sap.app"]?.dataSources);
        const annotationFiles = await dataSourceManager.createAnnotationFiles(languages, i18nManager, serviceRequestor);
        const i18nFiles = i18nManager.createFiles(i18nPathName);

        if (i18nManager.hasTranslations()) {
            this.updateManifestModel(baseAppManifest, modelName, i18nPathName);
        }

        return new Map([...annotationFiles, ...i18nFiles]);
    }


    private updateManifestModel(baseAppManifest: any, modelName: string, i18nPathName: string) {
        const uri = `${i18nPathName}/i18n.properties`;
        this.enhanceManifestModel(baseAppManifest, modelName, uri);
        //TODO: switch to this after resolving @i18n custom model
        //this.createManifestModel(baseAppManifest, modelName, uri);
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
