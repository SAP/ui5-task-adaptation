import CFLocal = require("@sap/cf-tools/out/src/cf-local");
import CFToolsCli = require("@sap/cf-tools/out/src/cli");
import { eFilters } from "@sap/cf-tools/out/src/types";
import { CliResult } from "@sap/cf-tools/out/src/types";
import { Messages } from "../i18n/messages";
import { IGetServiceInstanceParams, IServiceKeys, IServiceInstance, IResource, ICreateServiceInstanceParams } from "../model/types";
const log = require("@ui5/logger").getLogger("@ui5/task-adaptation::CFUtil");

export default class CFUtil {

    private static async createService({ spaceGuid, planName, name, tags }: ICreateServiceInstanceParams) {
        const resources = await this.requestCfApi(`/v3/service_offerings?per_page=1000&space_guids=${spaceGuid}`);
        let html5AppsRepoRt = resources.find((resource: any) => resource.tags && tags.every(tag => resource.tags.includes(tag)));
        if (html5AppsRepoRt) {
            log(`Creating service instance '${name}' of service '${html5AppsRepoRt.name}' with '${planName}' plan`);
            try {
                await this.cfExecute(["create-service", html5AppsRepoRt.name, planName, name]);
            } catch (error) {
                throw new Error(Messages.FAILED_TO_CREATE_SERVICE_INSTANCE(name, spaceGuid, error.message));
            }
        } else {
            throw new Error(Messages.HTML5_REPO_RUNTIME_NOT_FOUND);
        }
    }

    /**
     * Get or create service keys for service instance found by query
     * @param {object} getServiceInstanceParams space guid
     * @param {CFUtil} cfUtil utility to communicate with CF
     * @returns {Promise<string[]>} credentials json object
     */
    public static async getServiceInstanceKeys(getServiceInstanceParams: IGetServiceInstanceParams,
        createServiceInstanceParams?: ICreateServiceInstanceParams): Promise<IServiceKeys | undefined> {
        let serviceInstances = await this.getServiceInstance(getServiceInstanceParams);
        if (!(serviceInstances?.length > 0) && createServiceInstanceParams) {
            await this.createService(createServiceInstanceParams);
            serviceInstances = await this.getServiceInstance(getServiceInstanceParams);
        }
        if (!(serviceInstances?.length > 0)) {
            throw new Error("Cannot find HTML5 Repo Runtime service in current space: " + getServiceInstanceParams.spaceGuids);
        }
        // we can use any instance in the list to connect to HTML5 Repo
        log.debug(`Use '${serviceInstances[0].name}' HTML5 Repo Runtime service instance`);
        return {
            credentials: await this.getOrCreateServiceKeys(serviceInstances[0]),
            serviceInstance: serviceInstances[0]
        }
    }

    private static async getOrCreateServiceKeys(serviceInstance: IServiceInstance) {
        const credentials = await this.getServiceKeys(serviceInstance.guid);
        if (credentials.length === 0) {
            const serviceKeyName = serviceInstance.name + "_key";
            log(`Creating service key '${serviceKeyName}' for service instance '${serviceInstance.name}'`);
            await this.createServiceKey(serviceInstance.name, serviceKeyName);
        } else {
            return credentials;
        }
        return this.getServiceKeys(serviceInstance.guid);
    }

    private static async getServiceKeys(serviceInstanceGuid: string): Promise<any> {
        return CFLocal.cfGetInstanceCredentials({
            filters: [{
                value: serviceInstanceGuid,
                key: eFilters.service_instance_guid
            }]
        });
    }

    private static async createServiceKey(serviceInstanceName: string, serviceKeyName: any) {
        const cliResult = await this.cfExecute(["create-service-key", serviceInstanceName, serviceKeyName]);
        if (cliResult.exitCode !== 0) {
            throw new Error(Messages.COULD_NOT_CREATE_SERVICE_KEY_ERR_MSG(serviceInstanceName));
        }
    }

    /**
     * Get service instance by space and plan guids
     *
     * @param {object} parameters
     * @param {string[]} [parameters.spaceGuids] space guids
     * @param {string[]} [parameters.planNames] plan names
     * @param {string[]} [parameters.names] service instance names
     * @returns {Promise<{name:string, guid: string}[]>} service key
     * @memberof CFUtil
     */
    private static async getServiceInstance(params: IGetServiceInstanceParams): Promise<IServiceInstance[]> {
        const PARAM_MAP: Map<string, string> = new Map([["spaceGuids", "space_guids"], ["planNames", "service_plan_names"], ["names", "names"]]);
        const parameters = Object.entries(params)
            .filter(([_, value]) => value?.length > 0)
            .map(([key, value]) => `${PARAM_MAP.get(key)}=${value.join(",")}`);
        const uri = `/v3/service_instances` + (parameters.length > 0 ? `?${parameters.join("&")}` : "");
        const resources = await this.requestCfApi(uri);
        return resources.map((service: any) => ({
            name: service.name,
            guid: service.guid
        }));
    }

    private static async requestCfApi(url: string): Promise<IResource[]> {
        const response = await this.cfExecute(["curl", url]);
        const json = this.parseJson(response);
        const resources: any[] = json?.resources;
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

    private static async cfExecute(params: string[]) {
        const MAX_ATTEMPTS = 3;
        const errors = new Set<string>();
        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            try {
                const response = await CFToolsCli.Cli.execute(params, { env: { "CF_COLOR": "false" } });
                if (response.exitCode === 0) {
                    const errorValues = [...errors.values()];
                    if (errorValues?.length > 0) {
                        console.debug(this.errorsToString(errorValues));
                    }
                    return response;
                }
                errors.add(response.stderr);
            } catch (error) {
                errors.add(error.message);
            }
        }
        throw new Error(Messages.RETRY_MESSAGE(params) + ": " + this.errorsToString([...errors.values()]));
    }

    private static errorsToString(errors: string[]) {
        return errors.length > 1 ? errors.map(Messages.RETRY_ATTEMPT).join("; ") : errors.map(error => error);
    }

    private static parseJson(response: CliResult) {
        try {
            return JSON.parse(response.stdout);
        } catch (error) {
            throw new Error(Messages.FAILED_TO_PARSE_RESPONSE_FROM_CF(error.message));
        }
    }
}