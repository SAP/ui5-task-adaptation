import { IConfiguration, IMetadata } from "../model/types.js";

import AbapProvider from "./abapProvider.js";
import { getLogger } from "@ui5/logger";
import { unzipZipEntries } from "../util/zipUtil.js";

const log = getLogger("@ui5/task-adaptation::AbapRepoManager");

const REQUEST_OPTIONS_XML = {
    responseType: "text",
    headers: {
        "Accept": "text/html,application/xhtml+xml,application/xml"
    }
};

const REQUEST_OPTIONS_JSON = {
    headers: {
        "Accept": "application/json"
    }
};

export default class AbapRepoManager {

    private configuration: IConfiguration;
    private abapProvider: AbapProvider;


    constructor(configuration: IConfiguration, abapProvider?: AbapProvider) {
        this.configuration = configuration;
        this.abapProvider = abapProvider ? abapProvider : new AbapProvider();
    }


    async getAnnotationMetadata(uri: string): Promise<IMetadata> {
        const provider = await this.abapProvider.get(this.configuration);
        const response = await provider.head(uri);
        return { changedOn: response.data.modified };
    }


    async downloadAnnotationFile(uri: string) {
        const provider = await this.abapProvider.get(this.configuration);
        const response = await provider.get(uri, {
            headers: REQUEST_OPTIONS_XML.headers
        });
        return new Map([["annotation.xml", response.data]]);
    }


    async getMetadata(id: string): Promise<IMetadata> {
        const provider = await this.abapProvider.get(this.configuration);
        const appIndex = provider.getAppIndex();
        const response = await appIndex.get("/ui5_app_info_json", {
            params: { id },
            headers: REQUEST_OPTIONS_JSON.headers
        });
        const data = JSON.parse(response.data);
        if (!data || !data[id]) {
            log.warn(`UI5AppInfoJson request doesn't contain cache buster token for sap.app/id '${id}'. Fallback to download.`);
        }
        return {
            changedOn: data && data[id] && data[id].url,
            id
        };
    }


    async downloadBaseAppFiles(): Promise<Map<string, string>> {
        const { destination, appName } = this.configuration;
        const encodedAppName = encodeURIComponent(appName!);
        const provider = await this.abapProvider.get(this.configuration);
        const ui5Repo = provider.getUi5AbapRepository();
        const response = await ui5Repo.get(`/Repositories('${encodedAppName}')`, {
            params: {
                DownloadFiles: "RUNTIME",
                CodePage: "UTF8",
                "$format": "json"
            }
        });
        const data = JSON.parse(response.data);
        if (data.d?.ZipArchive.length > 0) {
            const buffer = Buffer.from(data.d.ZipArchive, "base64");
            return unzipZipEntries(buffer);
        }
        throw new Error(`App '${appName}' from '${destination}' doesn't contain files`);
    }
}
