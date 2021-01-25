//@ts-check
const request = require("request");
const cfLocal = require("@sap/cf-tools/out/src/cf-local");
const cfCli = require("@sap/cf-tools/out/src/cli").Cli;
const logger = require("@ui5/logger");
const { eFilters } = require("@sap/cf-tools/out/src/types");
const log = logger.getLogger("CFUtil");
const ENV = { env: { "CF_COLOR": "false" } };

class CFUtil {
    /**
     * Return current space
     * @static
     * @returns {Promise<any>} space object with guid
     * @memberof CFUtil
     */
    getSpace() {
        return cfLocal.cfGetConfigFileField("SpaceFields");
    }

    getToken(credentials) {
        log.info("Getting HTML5 Repo token");
        const uaa = credentials.uaa;
        const auth = Buffer.from(uaa.clientid + ":" + uaa.clientsecret);
        const options = {
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Basic " + auth.toString("base64")
            }
        };
        const uri = `${uaa.url}/oauth/token?grant_type=client_credentials`;
        return new Promise((resolve, reject) => {
            request.get(uri, options, (err, resp, body) => {
                if (err) {
                    reject(err);
                }
                resolve(JSON.parse(body)["access_token"]);
            });
        });
    }

    downloadZip(token, appHostId, uri) {
        log.info("Downloading base app zip from HTML5 Repo");
        const data = [];
        return new Promise((resolve, reject) => {
            request.get(uri, {
                gzip: true,
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + token,
                    "x-app-host-id": appHostId
                }
            }, (err, resp, body) => {
                if (err) {
                    reject(err);
                }
            }).on("data", (block) => {
                data.push(block);
            }).on("end", () => {
                resolve(Buffer.concat(data));
            });
        });
    }

    /**
     * Get HTML5 repo credentials
     * @param {string} spaceGuid space guid
     * @param {CFUtil} cfUtil utility to communicate with CF
     * @returns {Promise<any>} credentials json object
     */
    async getHtml5RepoCredentials(spaceGuid, cfUtil) {
        log.verbose("Getting HTML5 Repo Runtime credentials from space " + spaceGuid);
        const INSTANCE_NAME = "html5-apps-repo-instance";
        let credentials = await this.getServiceKeys({ spaceGuids: [spaceGuid], planNames: ["app-runtime"], names: [INSTANCE_NAME] }, cfUtil);
        if (credentials == null || credentials.length === 0) {
            await this.createService(spaceGuid, "app-runtime", INSTANCE_NAME, ["html5-apps-repo-rt"]);
            credentials = await this.getServiceKeys({ names: [INSTANCE_NAME] }, cfUtil);
        }
        if (credentials == null || credentials.length === 0) {
            throw new Error("Cannot find HTML5 Repo runtime in current space: " + spaceGuid);
        }
        return credentials[0];
    }

    /**
     * Get or create service keys for service instance found by query
     * @param {object} serviceInstanceQuery space guid
     * @param {CFUtil} cfUtil utility to communicate with CF
     * @returns {Promise<string[]>} credentials json object
     */
    async getServiceKeys(serviceInstanceQuery, cfUtil) {
        let serviceInstances = await cfUtil.getServiceInstance(serviceInstanceQuery);
        if (serviceInstances.length > 0) {
            return cfUtil.getOrCreateServiceKeys(serviceInstances[0].guid, serviceInstances[0].name);
        }
    }

    async createService(spaceGuid, plan, serviceInstanceName, tags = []) {
        const json = await this._requestCfApi(`/v3/service_offerings?per_page=1000&space_guids=${spaceGuid}`);
        const html5AppsRepoRt = json.resources.find(resource => resource.tags && tags.every(tag => resource.tags.includes(tag)));
        const query = await cfCli.execute(["create-service", html5AppsRepoRt.name, plan, serviceInstanceName], ENV);
        if (query.exitCode !== 0) {
            throw new Error(`Cannot create a service instance '${serviceInstanceName}' in space '${spaceGuid}'`);
        }
        log.verbose(query.stdout);
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
    async getServiceInstance({ spaceGuids, planNames, names }) {
        try {
            const parameters = [];
            if (spaceGuids && spaceGuids.length > 0) {
                parameters.push(`space_guids=${spaceGuids.join(",")}`);
            }
            if (planNames && planNames.length > 0) {
                parameters.push(`service_plan_names=${planNames.join(",")}`);
            }
            if (names && names.length > 0) {
                parameters.push(`names=${names.join(",")}`);
            }
            const uri = `/v3/service_instances` + (parameters.length > 0 ? `?${parameters.join("&")}` : "");
            const json = await this._requestCfApi(uri);
            return json.resources.map((service) => ({
                name: service.name,
                guid: service.guid
            }));
        } catch (error) {
            throw new Error("Failed to request for HTML5 repo service instance: " + error.message);
        }
    }

    /**
     * Get service plan guids by space and plan name
     *
     * @static
     * @param {string} spaceGuid guid of the space in
     * @param {string} planName name of the plan to search
     * @returns {Promise<string[]>} list of plan guids
     * @memberof CFUtil
     */
    async getServicePlanGuids(spaceGuid, planName) {
        try {
            const uri = `/v3/service_plans?space_guids=${spaceGuid}&names=${planName}`;
            const json = await this._requestCfApi(uri);
            return json.resources.map((service) => service.guid);
        } catch (error) {
            throw new Error("Failed to request for HTML5 repo service plans: " + error.message);
        }
    }

    async getOrCreateServiceKeys(serviceInstanceGuid, serviceInstanceName) {
        const credentials = await this._getServiceKeys(serviceInstanceGuid);
        if (credentials.length === 0) {
            await this._createServiceKey(serviceInstanceName, serviceInstanceName + "_key");
            return this._getServiceKeys(serviceInstanceGuid);
        }
        return credentials;
    }

    async _getServiceKeys(serviceInstanceGuid) {
        return cfLocal.cfGetInstanceCredentials({
            filters: [{
                key: eFilters.service_instance_guid,
                value: serviceInstanceGuid
            }]
        });
    }

    async _createServiceKey(serviceInstanceName, serviceKeyName) {
        const cliResult = await cfCli.execute(["create-service-key", serviceInstanceName, serviceKeyName],
            { env: { "CF_COLOR": "false" } });
        if (cliResult.exitCode !== 0) {
            throw new Error("couldn't create a service key for instance: " + serviceInstanceName);
        }
    }

    async _requestCfApi(url) {
        const response = await cfCli.execute(["curl", url]);
        if (response.exitCode === 0) {
            try {
                return JSON.parse(response.stdout);
            } catch (error) {
                throw new Error("Failed parse response from request CF API: " + error.message);
            }
        }
        throw new Error(response.error || response.stdout);
    }
}

module.exports = CFUtil;