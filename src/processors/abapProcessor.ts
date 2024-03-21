import AbapRepoManager from "../repositories/abapRepoManager.js";
import AnnotationManager from "../annotationManager.js";
import BaseAppFilesCacheManager from "../cache/baseAppFilesCacheManager.js";
import { IConfiguration } from "../model/types.js";
import IProcessor from "./processor.js";
import { validateObject } from "../util/commonUtil.js";
import Language from "../model/language.js";

export default class AbapProcessor implements IProcessor {

    private abapRepoManager: AbapRepoManager;
    private configuration: IConfiguration;
    private cacheManager: BaseAppFilesCacheManager;
    private annotationManager: AnnotationManager;


    constructor(configuration: IConfiguration, cacheManager: BaseAppFilesCacheManager, abapRepoManager: AbapRepoManager,
        annotationManager: AnnotationManager) {
        this.configuration = configuration;
        this.abapRepoManager = abapRepoManager;
        this.cacheManager = cacheManager;
        this.annotationManager = annotationManager;
    }


    getBaseAppFiles(baseAppId: string): Promise<Map<string, string>> {
        return this.cacheManager.getFiles(
            () => this.abapRepoManager.getMetadata(baseAppId),
            () => this.abapRepoManager.downloadBaseAppFiles());
    }


    validateConfiguration(): void {
        validateObject(this.configuration, ["destination", "appName"], "should be specified in ui5.yaml configuration");
    }


    async updateLandscapeSpecificContent(renamedBaseAppManifest: any, baseAppFiles?: Map<string, string>): Promise<void> {
        const files = await this.annotationManager.process(renamedBaseAppManifest, (Language.create(this.configuration.languages)));
        if (baseAppFiles) {
            files.forEach((value, key) => baseAppFiles.set(key, value));
        }
    }


    getConfigurationType(): string {
        return "abap";
    }


    createAppVariantHierarchyItem(appVariantId: string, version: string) {
        return {
            appVariantId,
            version,
            layer: "VENDOR"
        }
    }
}