import CFLocal = require("@sap/cf-tools/out/src/cf-local");
import CFToolsCli = require("@sap/cf-tools/out/src/cli");

import { ICreateServiceInstanceParams, IGetServiceInstanceParams, IResource, IServiceInstance, IServiceKeys, KeyedMap } from "../model/types";

import { eFilters } from "@sap/cf-tools/out/src/types";

const log = require("@ui5/logger").getLogger("@ui5/task-adaptation::CFUtil");

export default class CFUtil {

    /**
     * Get or create service keys for service instance found by query
     * @static
     * @param {IGetServiceInstanceParams} getServiceInstanceParams query parameters to find a service instance by
     * @param {ICreateServiceInstanceParams} [createServiceInstanceParams] parameters to create a service instance
     * @return {Promise<IServiceKeys>} promise with service keys
     * @memberof CFUtil
     */
    static async getServiceInstanceKeys(getServiceInstanceParams: IGetServiceInstanceParams,
        createServiceInstanceParams?: ICreateServiceInstanceParams): Promise<IServiceKeys> {
        let serviceInstances = await this.getServiceInstance(getServiceInstanceParams);
        if (!(serviceInstances?.length > 0) && createServiceInstanceParams) {
            await this.createService(createServiceInstanceParams);
            serviceInstances = await this.getServiceInstance(getServiceInstanceParams);
        }
        if (!(serviceInstances?.length > 0)) {
            throw new Error(`Cannot find '${getServiceInstanceParams.names?.join(", ")}' service in current space: ${getServiceInstanceParams.spaceGuids?.join(", ")}`);
        }
        // we can use any instance in the list to connect to HTML5 Repo
        log.verbose(`Use '${serviceInstances[0].name}' HTML5 Repo Runtime service instance`);
        const serviceKeys = await this.getOrCreateServiceKeys(serviceInstances[0]);
        if (!(serviceKeys?.length > 0)) {
            throw new Error(`Cannot get service keys for '${getServiceInstanceParams.names?.join(", ")}' service in current space: ${getServiceInstanceParams.spaceGuids?.join(", ")}`);
        }
        return {
            credentials: serviceKeys[0].credentials,
            serviceInstance: serviceInstances[0]
        }
    }


    static async createService(params: ICreateServiceInstanceParams) {
        log.verbose(`Creating a service instance with parameters: ${JSON.stringify(params)}`);
        const resources = await this.requestCfApi(`/v3/service_plans?names=${params.planName}&space_guids=${params.spaceGuid}`);
        const publicPlan = resources.find(resource => resource.visibility_type === "public");
        if (!publicPlan) {
            throw new Error(`Cannot find a public plan by name '${params.serviceName}' in space '${params.spaceGuid}'`);
        }
        try {
            await CFLocal.cfCreateService(publicPlan.guid, params.serviceName, params.parameters, params.tags);
        } catch (error) {
            throw new Error(`Cannot create a service instance '${params.serviceName}' in space '${params.spaceGuid}': ${error.message}`);
        }
    }


    private static async getOrCreateServiceKeys(serviceInstance: IServiceInstance): Promise<IServiceKeys[]> {
        const credentials = await this.getServiceKeys(serviceInstance.guid);
        if (credentials.length === 0) {
            const serviceKeyName = serviceInstance.name + "_key";
            log.info(`Creating service key '${serviceKeyName}' for service instance '${serviceInstance.name}'`);
            await this.createServiceKey(serviceInstance.name, serviceKeyName);
        } else {
            return credentials;
        }
        return this.getServiceKeys(serviceInstance.guid);
    }


    private static getServiceKeys(serviceInstanceGuid: string): Promise<any> {
        return CFLocal.cfGetInstanceCredentials({
            filters: [{
                value: serviceInstanceGuid,
                key: eFilters.service_instance_guids
            }]
        }).catch((error: any) => {
            throw Error("Failed to get service credentials: " + error.message);
        });
    }


    private static async createServiceKey(serviceInstanceName: string, serviceKeyName: string) {
        try {
            return this.cfExecute(["create-service-key", serviceInstanceName, serviceKeyName]);
        } catch (error) {
            throw new Error(`Couldn't create a service key for instance: ${serviceInstanceName}`);
        }
    }


    private static async getServiceInstance(params: IGetServiceInstanceParams): Promise<IServiceInstance[]> {
        const PARAM_MAP: KeyedMap<IGetServiceInstanceParams, keyof IGetServiceInstanceParams, string> = {
            spaceGuids: "space_guids",
            planNames: "service_plan_names",
            names: "names"
        };
        const parameters = Object.entries(params)
            .filter(([_, value]) => value?.length && value?.length > 0)
            .map(([key, value]) => `${PARAM_MAP[key]}=${value?.join(",")}`);
        const uri = `/v3/service_instances` + (parameters.length > 0 ? `?${parameters.join("&")}` : "");
        const resources = await this.requestCfApi(uri);
        return resources.map((service: IServiceInstance) => ({
            name: service.name,
            guid: service.guid
        }));
    }


    static async requestCfApi(url: string): Promise<IResource[]> {
        const response = await this.cfExecute(["curl", url]);
        const json = this.parseJson(response);
        const resources: IResource[] = json?.resources;
        const totalPages = json?.pagination?.total_pages;
        if (totalPages > 1) {
            const pages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
            return resources.concat(await Promise.all(pages.map(async (page: number) => {
                const uri = `${url}${url.includes("?") ? "&" : "?"}page=${page}`;
                const response = await this.cfExecute(["curl", uri]);
                return this.parseJson(response)?.resources || [];
            })).then(resources => [].concat(...resources)));
        }
        return resources;
    }


    public static getOAuthToken() {
        return this.cfExecute(["oauth-token"]);
    }


    private static async cfExecute(params: string[]): Promise<string> {
        const MAX_ATTEMPTS = 3;
        const errors = new Set<string>();
        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            try {
                const response = await CFToolsCli.Cli.execute(params, { env: { "CF_COLOR": "false" } });
                if (response.exitCode === 0) {
                    const errorValues = [...errors.values()];
                    if (errorValues?.length > 0) {
                        log.verbose(this.errorsToString(errorValues));
                    }
                    return response.stdout;
                }
                errors.add(response.error || response.stderr);
            } catch (error) {
                errors.add(error.message);
            }
        }
        throw new Error(`Failed to send request with parameters '${JSON.stringify(params)}': ${this.errorsToString([...errors.values()])}`);
    }


    private static errorsToString(errors: string[]) {
        return errors.length > 1
            ? errors.map((error, attempt) => `${attempt + 1} attempt: ${error}`).join("; ")
            : errors.map(error => error);
    }


    private static parseJson(jsonString: string) {
        try {
            return JSON.parse(jsonString);
        } catch (error) {
            throw new Error(`Failed parse response from request CF API: ${error.message}`);
        }
    }



    /**
     * Get space guid from configuration or local CF fodler
     * @static
     * @param {string} spaceGuid ui5.yaml options
     * @return {Promise<string>} promise with space guid
     * @memberof CFUtil
     */
    static async getSpaceGuid(spaceGuid?: string): Promise<string> {
        if (spaceGuid == null) {
            const spaceName = (await CFLocal.cfGetTarget())?.space;
            if (spaceName) {
                const resources = await this.requestCfApi(`/v3/spaces?names=${spaceName}`);
                for (const resource of resources) {
                    spaceGuid = resource.guid;
                    break;
                }
            }
        }
        if (spaceGuid == null) {
            throw new Error("Please login to Cloud Foundry with 'cf login' and try again");
        }
        return spaceGuid;
    }
}