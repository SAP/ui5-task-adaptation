import { ICreateServiceInstanceParams, ICredentials, IGetServiceInstanceParams, IResource, IServiceInstance, IServiceKeys, KeyedMap, ServiceCredentials } from "../model/types.js";
import { cfCreateService } from "@sap/cf-tools/out/src/cf-local.js";
import { getSpaceGuidThrowIfUndefined } from "@sap/cf-tools/out/src/utils.js";

import { Cli } from "@sap/cf-tools/out/src/cli.js";
import { getLogger } from "@ui5/logger";
import AuthenticationError from "../model/authenticationError.js";

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
        const credentials = await this.getOrCreateCredentials(serviceInstances[0]) as ICredentials;
        if (!credentials) {
            throw new Error(`Cannot get service keys for '${getServiceInstanceParams.names?.join(", ")}' service in current space: ${getServiceInstanceParams.spaceGuids?.join(", ")}`);
        }
        return {
            credentials,
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


    private static async getOrCreateCredentials(serviceInstance: IServiceInstance): Promise<ICredentials> {
        if (serviceInstance.type === "user-provided") {
            log.verbose(`Service instance '${serviceInstance.name}' is user-provided, fetching credentials directly`);
            return this.fetchCredentials(`/v3/service_instances/${serviceInstance.guid}/credentials`);
        }
        let key = await this.getNewestServiceKey(serviceInstance.guid);
        if (key == null) {
            const serviceKeyName = serviceInstance.name + "_key";
            log.info(`Creating service key '${serviceKeyName}' for service instance '${serviceInstance.name}'`);
            await this.createServiceKey(serviceInstance.name, serviceKeyName);
            key = await this.getNewestServiceKey(serviceInstance.guid);
            if (key == null) {
                throw new Error(`Service key was created for '${serviceInstance.name}' but could not be retrieved`);
            }
        }
        log.verbose(`Using service key '${key.name}' for service instance '${serviceInstance.name}'`);
        return this.fetchCredentials(`/v3/service_credential_bindings/${key.guid}/details`);
    }


    private static async fetchCredentials(url: string): Promise<ICredentials> {
        const parsed = this.parseJson(await this.cfExecute(["curl", url]));
        this.processCfErrors(parsed?.errors);
        return parsed.credentials as ICredentials;
    }


    private static async createServiceKey(serviceInstanceName: string, serviceKeyName: string) {
        try {
            return this.cfExecute(["create-service-key", serviceInstanceName, serviceKeyName]);
        } catch (error: any) {
            throw new Error(`Couldn't create a service key for instance: ${serviceInstanceName}: ${error}`);
        }
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
            guid: service.guid,
            type: service.type
        }));
    }

    static processCfErrors(errors?: ICfError[]) {
        if (!errors || errors.length === 0) {
            return;
        }
        const authError = errors.find(e => e.title === "CF-NotAuthenticated" || e.code === 10002);
        if (authError) {
            throw new AuthenticationError(authError.detail);
        }
        throw new Error(`Failed sending request to Cloud Foundry: ${JSON.stringify(errors)}`);
    }


    static async requestCfApi(url: string): Promise<IResource[]> {
        const response = await this.cfExecute(["curl", url]);
        const json = this.parseJson(response);
        this.processCfErrors(json?.errors);
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
                    if (response.stdout === "\n") {
                        throw new AuthenticationError();
                    }
                    return response.stdout;
                }
                errors.add(response.error || response.stderr);
            } catch (error: any) {
                if (error instanceof AuthenticationError) {
                    throw error;
                }
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
     * Return the most recently created service credential binding (key) for the given service instance,
     * or undefined if no keys exist.
     * @private
     * @static
     * @param {string} serviceInstanceGuid the service instance guid
     * @return {Promise<any | undefined>} the newest binding object ({ name, guid, created_at, … }) or undefined
     * @memberof CFUtil
     */
    private static async getNewestServiceKey(serviceInstanceGuid: string): Promise<any> {
        try {
            const keyList = await this.requestCfApi(`/v3/service_credential_bindings?type=key&service_instance_guids=${serviceInstanceGuid}`);
            if (!keyList?.length) {
                return undefined;
            }
            return keyList.toSorted((a: any, b: any) =>
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            )[0];
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
    static async getOrCreateServiceKeyWithEndpoints(serviceInstanceName: string, spaceGuid?: string): Promise<ServiceCredentials | undefined> {
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

        const credentials = await this.getOrCreateCredentials(serviceInstance) as ServiceCredentials;
        if (!credentials?.endpoints || !this.hasValidEndpoints(credentials.endpoints)) {
            log.info(`Service key for '${serviceInstance.name}' does not have endpoints with service urls for xs-app.json update`);
        }
        return credentials;
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

interface ICfError {
    code: number;
    title: string;
    detail: string;
    // Allow unexpected additional properties without failing type checks
    [key: string]: any;
}
