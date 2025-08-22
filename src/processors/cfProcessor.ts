import HTML5RepoManager from "../repositories/html5RepoManager.js";
import IAppInfo from "../model/appVariantIdHierarchyItem.js";
import { IConfiguration } from "../model/types.js";
import IProcessor from "./processor.js";
import { cached } from "../cache/cacheHolder.js";
import { validateObject } from "../util/commonUtil.js";
import CFUtil from "../util/cfUtil.js";

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


    async updateLandscapeSpecificContent(renamedBaseAppManifest: any, baseAppFiles: Map<string, string>): Promise<void> {
        this.updateCloudPlatform(renamedBaseAppManifest);
        await this.updateXsAppJson(baseAppFiles);
    }


    private async updateXsAppJson(baseAppFiles: Map<string, string>) {
        const xsAppJsonContent = baseAppFiles.get("xs-app.json");
        if (!xsAppJsonContent) {
            return;
        }

        const { serviceInstanceName, space } = this.configuration;
        if (!serviceInstanceName) {
            throw new Error(`Service instance name must be specified in ui5.yaml configuration for app '${this.configuration.appName}'`);
        }

        let serviceCredentials: any;
        try {
            // Get valid service keys with proper endpoints structure
            serviceCredentials = await CFUtil.getOrCreateServiceKeyWithEndpoints(serviceInstanceName, space);
        } catch (error: any) {
            throw new Error(`Failed to get valid service keys for app '${this.configuration.appName}': ${error.message}`);
        }

        const xsAppJson = JSON.parse(xsAppJsonContent);
        xsAppJson.routes = this.enhanceRoutesWithEndpointAndService(serviceCredentials, xsAppJson.routes);
        baseAppFiles.set("xs-app.json", JSON.stringify(xsAppJson, null, 2));
    }


    private enhanceRoutesWithEndpointAndService(serviceCredentials: any, baseRoutes: any) {
        const endpoints = serviceCredentials.endpoints as any[];
        // Map destinations to endpoint names
        const destinationToEndpoint = Object.entries(endpoints).reduce((acc: Record<string, string>, [endpointName, obj]) => {
            if (obj.destination) {
                acc[obj.destination as string] = endpointName;
            }
            return acc;
        }, {} as Record<string, string>);

        return baseRoutes.map((route: any) => {
            const endpointName = destinationToEndpoint[route.destination];
            if (endpointName) {
                // There is a matching endpoint: remove destination and add endpoint/service
                const { destination: _destination, ...rest } = route;
                return {
                    ...rest,
                    endpoint: endpointName,
                    service: serviceCredentials["sap.cloud.service"],
                };
            } else {
                // No match: return route unchanged
                return route;
            }
        });
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
