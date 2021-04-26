import * as AdmZip from "adm-zip";

import { IConfiguration, ICreateServiceInstanceParams, ICredentials, IGetServiceInstanceParams, IHTML5RepoInfo } from "./model/types";

import CFUtil from "./util/cfUtil";
import RequestUtil from "./util/requestUtil";
import { validateObject } from "./util/commonUtil";

const log = require("@ui5/logger").getLogger("@ui5/task-adaptation::HTML5RepoManager");

export default class HTML5RepoManager {

    static async getBaseAppFiles(configuration: IConfiguration): Promise<Map<string, string>> {
        const { token, baseUri } = await this.getHtml5RepoInfo(configuration);
        const entries = await this.getBaseAppZipEntries(configuration, baseUri, token);
        return this.mapEntries(entries);
    }


    static async getMetadata(configuration: IConfiguration): Promise<any> {
        const { token, baseUri } = await this.getHtml5RepoInfo(configuration);
        return this.requestMetadata(configuration, baseUri, token);
    }


    private static async getHtml5RepoInfo(configuration: IConfiguration): Promise<IHTML5RepoInfo> {
        const spaceGuid = await CFUtil.getSpaceGuid(configuration?.spaceGuid);
        const credentials = await this.getHTML5Credentials(spaceGuid);
        const token = await this.getToken(credentials);
        return {
            token,
            baseUri: credentials.uri
        };
    }


    private static async getHTML5Credentials(spaceGuid: string): Promise<ICredentials> {
        log.verbose("Getting HTML5 Repo Runtime credentials from space " + spaceGuid);
        const PLAN_NAME = "app-runtime";
        const SERVIСE_INSTANCE_NAME = "html5-apps-repo-runtime";
        const getParams: IGetServiceInstanceParams = {
            spaceGuids: [spaceGuid],
            planNames: [PLAN_NAME],
            names: [SERVIСE_INSTANCE_NAME]
        };
        const createParams: ICreateServiceInstanceParams = {
            spaceGuid,
            planName: PLAN_NAME,
            serviceName: SERVIСE_INSTANCE_NAME,
            tags: ["html5-apps-repo-rt"]
        };
        const serviceKeys = await CFUtil.getServiceInstanceKeys(getParams, createParams);
        return serviceKeys.credentials;
    }


    private static async getToken({ uaa }: ICredentials) {
        log.verbose("Getting HTML5 Repo token");
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


    private static async requestMetadata(options: IConfiguration, html5RepoBaseUri: string, token: string): Promise<AdmZip.IZipEntry[]> {
        validateObject(options, ["appHostId", "appName", "appVersion"], "should be specified in ui5.yaml configuration");
        const { appHostId, appName, appVersion } = options;
        const uri = `${html5RepoBaseUri}/applications/metadata/`;
        const requestOptions = {
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + token,
                "x-app-host-id": appHostId
            }
        }
        const metadata = await RequestUtil.get(uri, requestOptions);
        return metadata.find((item: any) => item.appHostId === appHostId && item.applicationName === appName && item.applicationVersion === appVersion);
    }


    private static async getBaseAppZipEntries(options: IConfiguration, html5RepoBaseUri: string, token: string): Promise<AdmZip.IZipEntry[]> {
        validateObject(options, ["appHostId", "appName", "appVersion"], "should be specified in ui5.yaml configuration");
        const { appHostId, appName, appVersion } = options;
        const uri = `${html5RepoBaseUri}/applications/content/${appName}-${appVersion}/`;
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