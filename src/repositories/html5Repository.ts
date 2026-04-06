import * as AdmZip from "adm-zip";

import { IConfiguration, ICreateServiceInstanceParams, ICredentials, IGetServiceInstanceParams, IHTML5RepoInfo, IReuseLibInfo } from "./../model/types.js";

import CFUtil from "../util/cfUtil.js";
import RequestUtil from "../util/requestUtil.js";
import { getLogger } from "@ui5/logger";
import { unzipZipEntries } from "../util/zipUtil.js";
import IRepository from "./repository.js";
import { IAppVariantIdHierarchyItem } from "../model/appVariantIdHierarchyItem.js";
import { cached } from "../cache/cacheHolder.js";
import { validateConfiguration } from "../util/commonUtil.js";

interface appData {
    appName: string,
    appVersion: string,
    appHostId: string,
}

const log = getLogger("@ui5/task-adaptation::HTML5Repository");

export default class HTML5Repository implements IRepository {

    constructor(private configuration: IConfiguration) {
        validateConfiguration(configuration, ["appHostId", "appName", "appVersion"]);
    }


    async getAppVariantIdHierarchy(appId: string): Promise<IAppVariantIdHierarchyItem[]> {
        const metadata = await this.getMetadata();
        return [{
            repoName: this.configuration.appName!,
            appVariantId: appId,
            cachebusterToken: metadata.changedOn
        }];
    }


    @cached()
    async fetch(_repoName: string, _cachebusterToken: string): Promise<Map<string, string>> {
        const { token, baseUri } = await this.getHtml5RepoInfo();
        const appData: appData = {
            appName: this.configuration.appName!,
            appVersion: this.configuration.appVersion!,
            appHostId: this.configuration.appHostId!
        };
        return this.getAppZipEntries(appData, baseUri, token);
    }


    @cached()
    async fetchReuseLib(_libName: string, _cachebusterToken: string, lib: IReuseLibInfo): Promise<Map<string, string>> {
        const { token, baseUri } = await this.getHtml5RepoInfo();
        const libAppData: appData = {
            appName: lib.html5AppName,
            appVersion: lib.html5AppVersion,
            appHostId: lib.html5AppHostId
        };
        return this.getAppZipEntries(libAppData, baseUri, token);
    }


    async getMetadata(): Promise<any> {
        const { token, baseUri } = await this.getHtml5RepoInfo();
        return this.requestMetadata(baseUri, token);
    }


    private async getHtml5RepoInfo(): Promise<IHTML5RepoInfo> {
        const spaceGuid = await CFUtil.getSpaceGuid(this.configuration?.space);
        const credentials = await this.getHTML5Credentials(spaceGuid);
        const token = await this.getToken(credentials);
        if (!token || token.length === 0) {
            throw new Error("Failed to obtain HTML5 Repo token");
        } else {
            log.verbose("Obtained HTML5 Repo token");
        }
        return {
            token,
            baseUri: credentials.uri
        };
    }


    private async getHTML5Credentials(spaceGuid: string): Promise<ICredentials> {
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
            serviceName: "html5-apps-repo",
            serviceInstanceName: SERVIСE_INSTANCE_NAME,
            tags: ["html5-apps-repo-rt"]
        };
        const serviceKeys = await CFUtil.getServiceInstanceKeys(getParams, createParams);
        return serviceKeys.credentials;
    }


    private async getToken({ uaa }: ICredentials): Promise<string> {
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


    private async requestMetadata(html5RepoBaseUri: string, token: string): Promise<AdmZip.IZipEntry[]> {
        const { appHostId, appName, appVersion } = this.configuration;
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


    private async getAppZipEntries(app: appData, html5RepoBaseUri: string, token: string): Promise<Map<string, string>> {
        const uri = `${html5RepoBaseUri}/applications/content/${app.appName}-${app.appVersion}/`;
        const zip = await this.download(token, app.appHostId!, uri);
        return unzipZipEntries(zip);
    }

    private async download(token: string, appHostId: string, uri: string): Promise<Buffer> {
        if (!token) {
            throw new Error("HTML5 token is undefined");
        }
        return RequestUtil.get(uri, {
            responseType: "arraybuffer",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + token,
                "x-app-host-id": appHostId
            }
        });
    }

    downloadAnnotationFile(_uri: string): Promise<Map<string, string>> {
        log.verbose("No annotation processing in CF");
        return Promise.resolve(new Map<string, string>());
    }

}
