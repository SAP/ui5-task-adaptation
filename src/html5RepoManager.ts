import * as AdmZip from "adm-zip";

import { IConfiguration, ICreateServiceInstanceParams, ICredentials, IGetServiceInstanceParams } from "./model/types";

import CFUtil from "./util/cfUtil";
import Logger from "@ui5/logger";
import RequestUtil from "./util/requestUtil";
import { validateObject } from "./util/commonUtil";

const log: Logger = require("@ui5/logger").getLogger("@ui5/task-adaptation::HTML5RepoManager");

export default class HTML5RepoManager {

    static async getBaseAppFiles(configuration: IConfiguration): Promise<Map<string, string>> {
        const spaceGuid = await CFUtil.getSpaceGuid(configuration);
        const credentials = await this.getHTML5Credentials(spaceGuid);
        const token = await this.getToken(credentials);
        const entries = await this.getBaseAppZipEntries(configuration, credentials, token);
        return this.mapEntries(entries);
    }


    private static async getHTML5Credentials(spaceGuid: string): Promise<ICredentials> {
        log.verbose("Getting HTML5 Repo Runtime credentials from space " + spaceGuid);
        const PLAN_NAME = "app-runtime";
        const SERVIE_INSTANCE_NAME = "html5-apps-repo-runtime";
        const getParams: IGetServiceInstanceParams = {
            spaceGuids: [spaceGuid],
            planNames: [PLAN_NAME],
            names: [SERVIE_INSTANCE_NAME]
        };
        const createParams: ICreateServiceInstanceParams = {
            spaceGuid,
            planName: PLAN_NAME,
            name: SERVIE_INSTANCE_NAME,
            tags: ["html5-apps-repo-rt"]
        };
        const serviceKeys = await CFUtil.getServiceInstanceKeys(getParams, createParams);
        return serviceKeys.credentials;
    }


    private static async getToken({ uaa }: ICredentials) {
        log.info("Getting HTML5 Repo token");
        const auth = Buffer.from(uaa.clientid + ":" + uaa.clientsecret);
        const options = {
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Basic " + auth.toString("base64")
            }
        };
        const uri = `${uaa.url}/oauth/token?grant_type=client_credentials`;
        return RequestUtil.get(uri, options).then((json: any) => json["access_token"]);
    }


    private static async getBaseAppZipEntries(options: IConfiguration, htmlRepoCredentials: ICredentials, token: string): Promise<AdmZip.IZipEntry[]> {
        validateObject(options, ["appHostId", "appName", "appVersion"], "should be specified in ui5.yaml configuration");
        const { appHostId, appName, appVersion } = options;
        const uri = `${htmlRepoCredentials.uri}/applications/content/${appName}-${appVersion}/`;
        const zip = await RequestUtil.download(token, appHostId!, uri);
        let admZip;
        try {
            admZip = new AdmZip(zip);
            return admZip.getEntries();
        } catch (error) {
            throw new Error("Failed to parse zip content from HTML5 Repository: " + error.message);
        }
    }


    private static mapEntries(entries: AdmZip.IZipEntry[]): Map<string, string> {
        return new Map(entries.filter(entry => !entry.isDirectory).map(entry => [entry.entryName, entry.getData().toString("utf8")]));
    }
}