//@ts-check
const request = require("request");
const cfLocal = require("@sap/cf-tools/out/src/cf-local");
const cfCli = require("@sap/cf-tools/out/src/cli").Cli;
const logger = require("@ui5/logger");
const { eFilters } = require("@sap/cf-tools/out/src/types");
const log = logger.getLogger("CFUtil");

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
        log.info("Getting HTML5 Repo runtime from space " + spaceGuid);
        const planGuids = await cfUtil.getServicePlanGuids(spaceGuid, "app-runtime");
        if (!planGuids || planGuids.length === 0) {
            throw new Error("Cannot find HTML5 Repo runtime in current space: " + spaceGuid);
        }
        const services = await Promise.all(planGuids.map(async (planGuid) => {
            const serviceInstances = await cfUtil.getServiceInstance(spaceGuid, planGuid);
            return Promise.all(serviceInstances.map((instance) =>
                cfUtil.getOrCreateServiceKeys(instance.guid, instance.name)));
        }));
        const credentials = [].concat.apply([], [].concat.apply([], services)); // eslint-disable-line prefer-spread
        if (credentials.length === 0) {
            throw new Error("Cannot find HTML5 Repo runtime in current space: " + spaceGuid);
        }
        return credentials[0];
    }

	/**
	 * Get service instance by space and plan guids
	 *
	 * @static
	 * @param {string} spaceGuid space guid
	 * @param {string} planGuid plan guid
	 * @returns {Promise<{name:string, guid: string}[]>} service key
	 * @memberof CFUtil
	 */
    async getServiceInstance(spaceGuid, planGuid) {
        try {
            const uri = `/v2/service_instances?q=service_plan_guid:${planGuid}&q=space_guid:${spaceGuid}`;
            const json = await this._requestCfApi(uri);
            return json.resources.map((service) => ({
                name: service.entity.name,
                guid: service.metadata.guid
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