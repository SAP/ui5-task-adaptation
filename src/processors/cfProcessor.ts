import HTML5RepoManager from "../repositories/html5RepoManager.js";
import IAppInfo from "../model/appVariantIdHierarchyItem.js";
import { IConfiguration } from "../model/types.js";
import IProcessor from "./processor.js";
import { cached } from "../cache/cacheHolder.js";
import { validateObject } from "../util/commonUtil.js";

export default class CFProcessor implements IProcessor {

    private configuration: IConfiguration;

    constructor(configuration: IConfiguration) {
        this.configuration = configuration;
    }


    async getAppVariantIdHierarchy(appId: string): Promise<IAppInfo[]> {
        const metadata = await HTML5RepoManager.getMetadata(this.configuration);
        return [{
            repoName: this.configuration.appName!,
            appVariantId: appId,
            cachebusterToken: metadata.changedOn
        }];
    }


    @cached()
    fetch(_repoName: string, _cachebusterToken: string): Promise<Map<string, string>> {
        return HTML5RepoManager.getBaseAppFiles(this.configuration);
    }


    validateConfiguration(): void {
        validateObject(this.configuration, ["appHostId", "appName", "appVersion"], "should be specified in ui5.yaml configuration");
    }


    async updateLandscapeSpecificContent(renamedBaseAppManifest: any): Promise<void> {
        this.updateCloudPlatform(renamedBaseAppManifest);
    }


    private updateCloudPlatform(renamedBaseAppManifest: any) {
        const sapCloudService = renamedBaseAppManifest["sap.cloud"]?.service;
        const sapPlatformCf = renamedBaseAppManifest["sap.platform.cf"];
        if (sapPlatformCf?.oAuthScopes && sapCloudService) {
            sapPlatformCf.oAuthScopes = sapPlatformCf.oAuthScopes.map((scope: string) =>
                scope.replace(`$XSAPPNAME.`, `$XSAPPNAME('${sapCloudService}').`));
        }
        if (this.configuration.sapCloudService) {
            if (renamedBaseAppManifest["sap.cloud"] == null) {
                renamedBaseAppManifest["sap.cloud"] = {};
            }
            renamedBaseAppManifest["sap.cloud"].service = this.configuration.sapCloudService;
        } else {
            delete renamedBaseAppManifest["sap.cloud"];
        }
    }


    getConfigurationType(): string {
        return "cf";
    }


    createAppVariantHierarchyItem(appVariantId: string, version: string) {
        return {
            appVariantId,
            version
        }
    }
}