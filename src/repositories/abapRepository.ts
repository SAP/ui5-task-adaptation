import { IConfiguration, IMetadata } from "../model/types.js";

import AbapProvider from "./abapProvider.js";
import { IAppVariantIdHierarchyItem } from "../model/appVariantIdHierarchyItem.js";
import { getLogger } from "@ui5/logger";
import { unzipZipEntries } from "../util/zipUtil.js";
import IRepository from "./repository.js";
import { cached } from "../cache/cacheHolder.js";
import ICachedResource from "../cache/cachedResource.js";

const log = getLogger("@ui5/task-adaptation::AbapRepository");

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


type IAbapResource = ICachedResource

export default class AbapRepository implements IRepository {

    private configuration: IConfiguration;
    private abapProvider: AbapProvider;


    constructor(configuration: IConfiguration, abapProvider?: AbapProvider) {
        this.configuration = configuration;
        this.abapProvider = abapProvider ? abapProvider : new AbapProvider();
    }


    async getAppVariantIdHierarchy(id: string): Promise<IAbapResource[]> {
        const provider = await this.abapProvider.get(this.configuration);
        const lrep = provider.getLayeredRepository();
        const response = await lrep.get("/dta_folder/app_info", {
            params: { id }
        });
        if (response.status === 200) {
            const hierarchy = JSON.parse(response.data)?.appVariantIdHierarchy as IAppVariantIdHierarchyItem[];
            return hierarchy.map(item => ({
                appName: item.repoName,
                cacheBusterToken: Promise.resolve(item.cachebusterToken)
            }));
        } else if (this.configuration.appName) {
            // Fallback to old API on old ABAP backend or CF for backward compatibility
            return [{
                appName: this.configuration.appName,
                cacheBusterToken: this.getMetadata(id).then(metadata => metadata.changedOn),
            }];
        }
        throw new Error(`App variant id hierarchy for app id '${id}' is not provided`);
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


    @cached()
    async fetch(resource: IAbapResource): Promise<Map<string, string>> {
        const encodedRepoName = encodeURIComponent(resource.appName);
        const provider = await this.abapProvider.get(this.configuration);
        const ui5Repo = provider.getUi5AbapRepository();
        const response = await ui5Repo.get(`/Repositories('${encodedRepoName}')`, {
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
        throw new Error(`App '${resource.appName}' doesn't contain files`);
    }
}
