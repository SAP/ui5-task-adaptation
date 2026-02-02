import AbapRepoManager from "../repositories/abapRepoManager.js";
import AnnotationManager from "../annotationManager.js";
import IAppVariantIdHierarchyItem from "../model/appVariantIdHierarchyItem.js";
import { IConfiguration } from "../model/types.js";
import IProcessor from "./processor.js";
import Language from "../model/language.js";
import { cached } from "../cache/cacheHolder.js";
import { validateObject } from "../util/commonUtil.js";

export default class AbapProcessor implements IProcessor {

    private abapRepoManager: AbapRepoManager;
    private configuration: IConfiguration;
    private annotationManager: AnnotationManager;


    constructor(configuration: IConfiguration, abapRepoManager: AbapRepoManager,
        annotationManager: AnnotationManager) {
        this.configuration = configuration;
        this.abapRepoManager = abapRepoManager;
        this.annotationManager = annotationManager;
    }


    getAppVariantIdHierarchy(appId: string): Promise<IAppVariantIdHierarchyItem[]> {
        return this.abapRepoManager.getAppVariantIdHierarchy(appId);
    }


    @cached()
    fetch(repoName: string, _cachebusterToken: string): Promise<Map<string, string>> {
        return this.abapRepoManager.fetch(repoName);
    }

    fetchReuseLib(): Promise<Map<string, string>> {
        throw new Error("Preview is not available on SAP S/4HANA On-Premise or Cloud Systems. Please create a ticket on CA-UI5-FL-ADP-BAS component.");
    }


    validateConfiguration(): void {
        // validate general app config
        const properties: Array<keyof IConfiguration> = ["appName"];
        validateObject(this.configuration, properties, "should be specified in ui5.yaml configuration");
    }


    async updateLandscapeSpecificContent(baseAppManifest: any, baseAppFiles: Map<string, string>, appVariantId: string, prefix: string): Promise<void> {
        const languages = Language.create(this.configuration.languages)
        const files = await this.annotationManager.process(baseAppManifest, languages, appVariantId, prefix);
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
