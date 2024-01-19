import AbapRepoManager from "../repositories/abapRepoManager";
import AnnotationManager from "../annotationManager";
import BaseAppFilesCacheManager from "../cache/baseAppFilesCacheManager";
import { IConfiguration } from "../model/types";
import IProcessor from "./processor";
import { validateObject } from "../util/commonUtil";
import Language from "../model/language";

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