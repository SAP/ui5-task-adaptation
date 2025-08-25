import { ICreateServiceInstanceParams, IGetServiceInstanceParams, IResource, IServiceInstance, IServiceKeys, KeyedMap } from "../model/types.js";
import { cfCreateService, cfGetInstanceCredentials } from "@sap/cf-tools/out/src/cf-local.js";
import { getSpaceGuidThrowIfUndefined } from "@sap/cf-tools/out/src/utils.js";

import { Cli } from "@sap/cf-tools/out/src/cli.js";
import { eFilters } from "@sap/cf-tools/out/src/types.js";
import { getLogger } from "@ui5/logger";

const log = getLogger("@ui5/task-adaptation::CFUtil");

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
        const serviceOfferings = await this.requestCfApi(`/v3/service_offerings?names=${params.serviceName}`);
        if (serviceOfferings.length === 0) {
            throw new Error(`Cannot find a service offering by name '${params.serviceName}'`);
        }
        const plans = await this.requestCfApi(`/v3/service_plans?service_offering_guids=${serviceOfferings[0].guid}`);
        const plan = plans.find(plan => plan.name === params.planName);
        if (!plan) {
            throw new Error(`Cannot find a plan by name '${params.planName}' for service '${params.serviceName}'`);
        }
        try {
            await cfCreateService(plan.guid, params.serviceInstanceName, params.parameters, params.tags);
        } catch (error: any) {
            throw new Error(`Cannot create a service instance '${params.serviceInstanceName}' in space '${params.spaceGuid}': ${error.message}`);
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
        return cfGetInstanceCredentials({
            filters: [{
                value: serviceInstanceGuid,
                key: eFilters.service_instance_guids
            }]
        }).catch((error: any) => {
            throw new Error("Failed to get service credentials: " + error.message);
        });
    }


    private static async createServiceKey(serviceInstanceName: string, serviceKeyName: string) {
        try {
            return this.cfExecute(["create-service-key", serviceInstanceName, serviceKeyName]);
        } catch (error: any) {
            throw new Error(`Couldn't create a service key for instance: ${serviceInstanceName}: ${error}`);
        }
    }

    private static deleteServiceKeyUnsafe(serviceInstanceName: string, serviceKeyName: string) {
        // Fire and forget - async delete without waiting for result or handling errors
        this.cfExecute(["delete-service-key", serviceInstanceName, serviceKeyName, "-f"]).catch(() => {
            // Ignore any errors - this is intentionally unsafe
        });
    }


    private static async getServiceInstance(params: IGetServiceInstanceParams): Promise<IServiceInstance[]> {
        const PARAM_MAP: KeyedMap<IGetServiceInstanceParams, keyof IGetServiceInstanceParams, string> = {
            spaceGuids: "space_guids",
            planNames: "service_plan_names",
            names: "names"
        };
        const parameters = Object.entries(params)
            .filter(([, value]) => value?.length && value?.length > 0)
            .map(([key, value]) => `${PARAM_MAP[key]}=${value?.join(",")}`);
        const uri = `/v3/service_instances` + (parameters.length > 0 ? `?${parameters.join("&")}` : "");
        const resources = await this.requestCfApi(uri);
        return resources.map((service: IServiceInstance) => ({
            name: service.name,
            guid: service.guid
        }));
    }


    static processErrors(json: any) {
        if (json?.errors?.length > 0) {
            const message = JSON.stringify(json.errors);
            if (json?.errors?.some((e: any) => e.title === "CF-NotAuthenticated" || e.code === 10002)) {
                throw new Error(`Authentication error. Use 'cf login' to authenticate in Cloud Foundry: ${message}`);
            }
            throw new Error(`Failed sending request to Cloud Foundry: ${message}`);
        }
    }


    static async requestCfApi(url: string): Promise<IResource[]> {
        const response = await this.cfExecute(["curl", url]);
        const json = this.parseJson(response);
        this.processErrors(json);
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
        return resources ?? [];
    }


    public static getOAuthToken() {
        return this.cfExecute(["oauth-token"]);
    }


    private static async cfExecute(params: string[]): Promise<string> {
        const MAX_ATTEMPTS = 3;
        const errors = new Set<string>();
        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            try {
                const response = await Cli.execute(params, { env: { "CF_COLOR": "false" } });
                if (response.exitCode === 0) {
                    const errorValues = [...errors.values()];
                    if (errorValues?.length > 0) {
                        log.verbose(this.errorsToString(errorValues));
                    }
                    return response.stdout;
                }
                errors.add(response.error || response.stderr);
            } catch (error: any) {
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
        } catch (error: any) {
            throw new Error(`Failed parse response from request CF API: ${error.message}`);
        }
    }


    /**
     * Get service keys and return the first one with valid endpoints
     * @private
     * @static
     * @param {string} serviceInstanceGuid the service instance guid
     * @return {Promise<any>} the first service key with valid endpoints, or null if none found
     * @memberof CFUtil
     */
    private static async getServiceKeyWithValidEndpoints(serviceInstanceGuid: string): Promise<any> {
        try {
            const serviceKeys = await this.getServiceKeys(serviceInstanceGuid);
            // Find and return the first key with valid endpoints
            return serviceKeys.find((key: any) => key.credentials?.endpoints && this.hasValidEndpoints(key.credentials.endpoints));
        } catch (error: any) {
            throw new Error("Failed to get service credentials: " + error.message);
        }
    }

    /**
     * Get service keys for a service instance by name. If the existing service key
     * has endpoints as strings instead of objects, a new service key will be created.
     * @static
     * @param {string} serviceInstanceName name of the service instance
     * @param {string} [spaceGuid] optional space guid, will use current space if not provided
     * @return {Promise<any>} promise with service key credentials
     * @memberof CFUtil
     */
    static async getOrCreateServiceKeyWithEndpoints(serviceInstanceName: string, spaceGuid?: string): Promise<any> {
        const resolvedSpaceGuid = await this.getSpaceGuid(spaceGuid);

        // Find service instance by name
        const serviceInstances = await this.getServiceInstance({
            names: [serviceInstanceName],
            spaceGuids: [resolvedSpaceGuid]
        });

        if (!(serviceInstances?.length > 0)) {
            throw new Error(`Cannot find service instance '${serviceInstanceName}' in space: ${resolvedSpaceGuid}`);
        }

        const serviceInstance = serviceInstances[0];
        log.verbose(`Found service instance '${serviceInstance.name}' with guid: ${serviceInstance.guid}`);

        // If no valid service key found, create a new one with unique name
        const uniqueServiceKeyNamePromise = this.generateUniqueServiceKeyName(serviceInstance.name, serviceInstance.guid);

        // Get service keys with credentials to find any with valid endpoints:
        // object with url and destination instead of a single url string
        const validKey = await this.getServiceKeyWithValidEndpoints(serviceInstance.guid);
        if (validKey) {
            log.verbose(`Using existing service key with valid endpoints structure`);
            return validKey.credentials;
        }

        const uniqueServiceKeyName = await uniqueServiceKeyNamePromise;
        log.verbose(`No valid service key found with proper endpoints structure. Creating new service key '${uniqueServiceKeyName}' for '${serviceInstance.name}'`);
        await this.createServiceKey(serviceInstance.name, uniqueServiceKeyName);

        // Get the newly created service key and validate its endpoints
        const newValidKey = await this.getServiceKeyWithValidEndpoints(serviceInstance.guid);
        if (newValidKey) {
            log.verbose(`Using newly created service key with valid endpoints structure`);
            return newValidKey.credentials;
        }

        // Clean up the created service key since it doesn't have valid
        // endpoints. We don't throw an error here even if no valid endpoints
        // found. We assume that there might be no coincidence between
        // credential endpoints and xs-app.json destinations.
        this.deleteServiceKeyUnsafe(serviceInstance.name, uniqueServiceKeyName);
        log.verbose(`Created service key '${uniqueServiceKeyName}' does not have valid endpoints structure. Triggered deletion of invalid service key '${uniqueServiceKeyName}'`);
    }




    /**
     * Check if endpoints object has at least one property that is an object
     * @private
     * @static
     * @param {any} endpoints the endpoints object to validate
     * @return {boolean} true if at least one property of endpoints is an object
     * @memberof CFUtil
     */
    private static hasValidEndpoints(endpoints: any): boolean {
        if (!endpoints || typeof endpoints !== 'object' || Array.isArray(endpoints)) {
            return false;
        }

        // Check if at least one property of endpoints is an object
        return Object.values(endpoints).some(value =>
            value && typeof value === 'object' && !Array.isArray(value)
        );
    }

    /**
     * Get all service key names for a service instance
     * @private
     * @static
     * @param {string} serviceInstanceGuid the service instance guid
     * @return {Promise<string[]>} promise with array of service key names
     * @memberof CFUtil
     */
    private static async getAllServiceKeyNames(serviceInstanceGuid: string): Promise<string[]> {
        try {
            const serviceKeys = await this.requestCfApi(`/v3/service_credential_bindings?type=key&service_instance_guids=${serviceInstanceGuid}`);
            return serviceKeys.map((key: any) => key.name);
        } catch (error: any) {
            throw new Error(`Failed to get service key names: ${error.message}`);
        }
    }

    /**
     * Generate a unique service key name in format serviceInstanceName-key-N
     * @static
     * @param {string} serviceInstanceName the service instance name
     * @param {string} serviceInstanceGuid the service instance guid
     * @return {Promise<string>} promise with unique service key name
     * @memberof CFUtil
     */
    static async generateUniqueServiceKeyName(serviceInstanceName: string, serviceInstanceGuid: string): Promise<string> {
        const existingKeyNames = await this.getAllServiceKeyNames(serviceInstanceGuid);

        let counter = 0;
        let keyName: string;

        do {
            keyName = `${serviceInstanceName}-key-${counter}`;
            counter++;
        } while (existingKeyNames.includes(keyName));

        log.verbose(`Generated unique service key name: ${keyName}`);
        return keyName;
    }


    /**
     * Get space guid from configuration or local CF fodler
     * @static
     * @param {string} spaceGuid ui5.yaml options
     * @return {Promise<string>} promise with space guid
     * @memberof CFUtil
     */
    static async getSpaceGuid(spaceGuid?: string): Promise<string> {
        return spaceGuid ?? getSpaceGuidThrowIfUndefined().catch((e: any) => {
            throw new Error("Please specify space and org guids in ui5.yaml or login to Cloud Foundry with 'cf login' and try again: " + e.message);
        });
    }
}