import cfLocal = require("@sap/cf-tools/out/src/cf-local");
import CFUtil from "./util/cfUtil";
import { IConfiguration, ICreateServiceInstanceParams, ICredentials, IGetServiceInstanceParams, IProjectOptions } from "./model/types";
import * as request from "request";
import * as AdmZip from "adm-zip";
import * as path from "path";
import ResourceUtil from "./util/resourceUtil";
import Logger from "@ui5/logger";
const log: Logger = require("@ui5/logger").getLogger("@ui5/task-adaptation::HTML5RepoManager");

export default class HTML5RepoManager {

    static async getBaseAppFiles(options: IProjectOptions): Promise<Map<string, string>> {
        const spaceGuid = await this.getSpace(options.configuration);
        const credentials = await this.getHTML5Credentials(spaceGuid);
        const token = await this.getToken(credentials);
        const entries = await this.getBaseAppZipEntries(options.configuration, credentials, token);
        return this.filterAndMapEntries(options.projectNamespace, entries);
    }

    private static async getSpace(options: IConfiguration) {
        let spaceGuid = options?.spaceGuid;
        if (spaceGuid == null) {
            spaceGuid = (await cfLocal.cfGetConfigFileField("SpaceFields"))?.GUID;
        }
        if (spaceGuid == null) {
            throw new Error("Please login to Cloud Foundry with 'cf login' and try again");
        }
        return spaceGuid;
    }

    private static async getHTML5Credentials(spaceGuid: string) {
        log.verbose("Getting HTML5 Repo Runtime credentials from space " + spaceGuid);
        const SERVIE_INSTANCE_NAME = "html5-apps-repo-runtime";
        const PLAN_NAME = "app-runtime";
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
        let serviceKeys = await CFUtil.getServiceInstanceKeys(getParams, createParams);
        if (serviceKeys == null) {
            throw new Error("Failed to get credentials of HTML5 Repository Runtime service");
        }
        return serviceKeys.credentials[0];
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
        return getToken(uri, options);
    }

    private static async getBaseAppZipEntries(options: IConfiguration, htmlRepoCredentials: ICredentials, token: string): Promise<AdmZip.IZipEntry[]> {
        const { appHostId, appName, appVersion } = options;
        const uri = `${(await htmlRepoCredentials).uri}/applications/content/${appName}-${appVersion}/`;
        const zip = await downloadZip(await token, appHostId, uri);
        let admZip;
        try {
            admZip = new AdmZip(zip);
        } catch (error) {
            throw new Error("Failed to parse zip content from HTML5 Repository: " + error.message);
        }
        return admZip.getEntries();
    }

    private static filterAndMapEntries(projectNamespace: string, entries: AdmZip.IZipEntry[]): Map<string, string> {
        const IGNORE_FILES = [
            path.sep + "manifest-bundle.zip",
            path.sep + "Component-preload.js",
            path.sep + "sap-ui-cachebuster-info.json"
        ];
        const getPath = (entry: AdmZip.IZipEntry) => {
            const paths = ResourceUtil.filepathToResources(projectNamespace);
            paths.push(entry.entryName);
            return path.resolve(path.sep + path.join(...paths));
        };
        const filteredEntries = entries.filter(entry => !IGNORE_FILES.includes(entry.entryName) && path.extname(getPath(entry)) != "");
        return new Map(filteredEntries.map(entry => [getPath(entry), entry.getData().toString("utf8")]));
    }
}

const getToken = (uri: string, options: any): Promise<string> => new Promise((resolve, reject) => {
    request.get(uri, options, (err, _, body) => {
        if (err) {
            reject(err);
        }
        resolve(JSON.parse(body)["access_token"]);
    });
});

const downloadZip = (token: string, appHostId: string, uri: string): Promise<Buffer> => {
    log.info("Downloading base app zip from HTML5 Repo");
    const data: Buffer[] = [];
    return new Promise((resolve, reject) => {
        request.get(uri, {
            gzip: true,
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + token,
                "x-app-host-id": appHostId
            }
        }, (err: Error) => {
            if (err) {
                reject(err);
            }
        }).on("data", (block: Buffer) => {
            data.push(block);
        }).on("end", () => {
            resolve(Buffer.concat(data));
        });
    });
}