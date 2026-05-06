import * as AdmZip from "adm-zip";

import { IConfiguration, ICreateServiceInstanceParams, ICredentials, IGetServiceInstanceParams, IHTML5RepoInfo } from "./../model/types.js";

import CFUtil from "../util/cfUtil.js";
import RequestUtil from "../util/requestUtil.js";
import { getLogger } from "@ui5/logger";
import { unzipZipEntries } from "../util/zipUtil.js";
import IRepository from "./repository.js";
import { cached } from "../cache/cacheHolder.js";
import CFValidator from "../util/validator/cfValidator.js";
import ICachedResource from "../cache/cachedResource.js";

export interface IHtml5Resource extends ICachedResource {
    appVersion: string;
    appHostId: string;
}

const log = getLogger("@ui5/task-adaptation::HTML5Repository");

export default class HTML5Repository implements IRepository {

    private validator = new CFValidator();

    constructor(private configuration: IConfiguration) {
        this.validator.validateConfiguration(configuration);
    }


    async getAppVariantIdHierarchy(_appId: string): Promise<IHtml5Resource[]> {
        const { appName, appVersion, appHostId } = this.configuration;
        if (!appName || !appVersion || !appHostId) {
            throw new Error("Missing required configuration properties appName, appVersion or appHostId");
        }
        return [{
            appName,
            cacheBusterToken: this.getMetadata().then(metadata => metadata.changedOn),
            appVersion,
            appHostId,
        }];
    }


    @cached()
    async fetch(resource: IHtml5Resource): Promise<Map<string, string>> {
        const { token, baseUri } = await this.getHtml5RepoInfo();
        return this.getAppZipEntries(resource, baseUri, token);
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
        const SERVICE_INSTANCE_NAME = "html5-apps-repo-runtime";
        const getParams: IGetServiceInstanceParams = {
            spaceGuids: [spaceGuid],
            planNames: [PLAN_NAME],
            names: [SERVICE_INSTANCE_NAME]
        };
        const createParams: ICreateServiceInstanceParams = {
            spaceGuid,
            planName: PLAN_NAME,
            serviceName: "html5-apps-repo",
            serviceInstanceName: SERVICE_INSTANCE_NAME,
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


    private async getAppZipEntries(resource: IHtml5Resource, html5RepoBaseUri: string, token: string): Promise<Map<string, string>> {
        const { appName, appVersion, appHostId } = resource;
        const uri = `${html5RepoBaseUri}/applications/content/${appName}-${appVersion}/`;
        const zip = await this.download(token, appHostId, uri);
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
