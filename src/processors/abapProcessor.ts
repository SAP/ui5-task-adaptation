import AbapRepoManager from "../repositories/abapRepoManager.js";
import AnnotationManager from "../annotationManager.js";
import { IAppVariantIdHierarchyItem } from "../model/appVariantIdHierarchyItem.js";
import { IConfiguration } from "../model/types.js";
import IProcessor from "./processor.js";
import { cached } from "../cache/cacheHolder.js";
import { validateObject } from "../util/commonUtil.js";
import { IAdapter } from "../adapters/adapter.js";
import AbapAdapter from "../adapters/abapAdapter.js";

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

    getAdapter(): IAdapter {
        return new AbapAdapter(this.configuration, this.annotationManager);
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


    getConfigurationType(): string {
        return "abap";
    }
}
