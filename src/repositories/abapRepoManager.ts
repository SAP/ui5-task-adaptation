import { IAuth, IConfiguration, IMetadata } from "../model/types";

import RequestUtil from "../util/requestUtil";
import { unzipZipEntries } from "../util/zipUtil";

const log = require("@ui5/logger").getLogger("@ui5/task-adaptation::AbapRepoManager");

const REQUEST_OPTIONS_XML = {
    responseType: "text",
    headers: {
        "Content-Type": "text/xml"
    }
};

const REQUEST_OPTIONS_JSON = {
    headers: {
        "Content-Type": "application/json"
    }
};

export default class AbapRepoManager {

    private auth?: IAuth;
    private configuration: IConfiguration;


    constructor(configuration: IConfiguration) {
        this.configuration = configuration;
    }


    async getAnnotationMetadata(uri: string): Promise<IMetadata> {
        const header = await RequestUtil.retryWithAuth<any>(
            () => RequestUtil.head(uri),
            () => RequestUtil.head(uri, this.getAuth()));
        return { changedOn: header.modified };
    }


    async downloadAnnotationFile(uri: string) {
        const annotation = await RequestUtil.retryWithAuth<string>(
            () => RequestUtil.get(uri, REQUEST_OPTIONS_XML),
            () => RequestUtil.get(uri, REQUEST_OPTIONS_XML, this.getAuth()));
        return new Map([["annotation.xml", annotation]]);
    }


    getMetadata(baseAppId: string): Promise<IMetadata> {
        return RequestUtil.retryWithAuth<IMetadata>(
            () => this.getMetadataRequest(baseAppId),
            () => this.getMetadataRequest(baseAppId, this.getAuth()));
    }


    downloadBaseAppFiles(): Promise<Map<string, string>> {
        return RequestUtil.retryWithAuth(
            () => this.downloadBaseAppFilesRequest(),
            () => this.downloadBaseAppFilesRequest(this.getAuth()));
    }


    private async getMetadataRequest(id: string, auth?: IAuth): Promise<IMetadata | undefined> {
        let uri = `https://${this.configuration.destination}.dest/sap/bc/ui2/app_index/ui5_app_info_json?id=${id}`;
        const data = await RequestUtil.get(uri, REQUEST_OPTIONS_JSON, auth);
        if (data && data[id]) {
            return {
                changedOn: data[id].url,
                id
            };
        }
        log.warn(`UI5AppInfoJson request doesn't contain cache buster token for sap.app/id '${id}'. Fallback to download.`);
    }


    private async downloadBaseAppFilesRequest(auth?: IAuth): Promise<Map<string, string>> {
        const { destination, appName } = this.configuration;
        const encodedAppName = encodeURIComponent(appName!);
        const uri = `https://${destination}.dest/sap/opu/odata/UI5/ABAP_REPOSITORY_SRV/Repositories('${encodedAppName}')?DownloadFiles=RUNTIME&CodePage=UTF8`;
        const data = await RequestUtil.get(uri, {}, auth);
        if (data?.d?.ZipArchive.length > 0) {
            const buffer = Buffer.from(data.d.ZipArchive, "base64");
            return unzipZipEntries(buffer);
        }
        throw new Error(`App '${appName}' from destination '${destination}' doesn't contain files`);
    }


    private getAuth(): IAuth | undefined {
        if (!this.auth) {
            if (this.configuration?.credentials) {
                let { username, password } = this.configuration?.credentials;
                if (username && password) {
                    const ENV_PREFIX = "env:";
                    username = username.substring(ENV_PREFIX.length);
                    password = password.substring(ENV_PREFIX.length);
                    if (process.env[username] && process.env[password]) {
                        this.auth = {
                            username: process.env[username]!,
                            password: process.env[password]!
                        };
                    }
                }
            }
        }
        if (!this.auth) {
            throw new Error("Please provide ABAP System credentials in .env file of the project: https://help.sap.com/docs/SAP_FIORI_tools/17d50220bcd848aa854c9c182d65b699/1c859274b511435ab6bd45f70e7f9af2.html.");
        }
        return this.auth;
    }
}