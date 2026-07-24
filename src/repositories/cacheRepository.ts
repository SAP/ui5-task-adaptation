import ICachedResource from "../cache/cachedResource.js";
import CacheHolder from "../cache/cacheHolder.js";
import { IConfiguration } from "../model/types.js";
import IRepository from "./repository.js";

export default class CacheRepository implements IRepository {

    constructor(private configuration: IConfiguration) { }


    async getAppVariantIdHierarchy(_appId: string): Promise<ICachedResource[]> {
        const { appName } = this.configuration;
        if (!appName) {
            throw new Error("previewManifest requires 'appName' in the ui5.yaml configuration");
        }
        return [{
            appName,
            cacheBusterToken: Promise.resolve("")
        }];
    }


    async fetch(resource: ICachedResource): Promise<Map<string, Buffer>> {
        const appName = resource.appName;
        const cachedFiles = await CacheHolder.readLatest(appName);
        if (cachedFiles.size === 0) {
            throw new Error(`No cached base app found for '${appName}'. Please check the appName or run a full build first to populate the cache.`);
        }
        return cachedFiles;
    }


    downloadAnnotationFile(uri: string): Promise<Map<string, string>> {
        throw new Error(`Download annotation file for uri: ${uri} is not available for CacheRepository.`);
    }
}

