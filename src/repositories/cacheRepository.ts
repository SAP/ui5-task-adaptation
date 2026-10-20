import ICachedResource from "../cache/cachedResource.js";
import CacheHolder from "../cache/cacheHolder.js";
import IRepository from "./repository.js";


export default class CacheRepository implements IRepository {

    constructor(private repository: IRepository) { }


    async getAppVariantIdHierarchy(appId: string): Promise<ICachedResource[]> {
        const mergedResource = CacheHolder.mergedResource(appId);
        if (await CacheHolder.hasDirectory(mergedResource)) {
            return [mergedResource];
        }
        return this.repository.getAppVariantIdHierarchy(appId);
    }


    async fetch(resource: ICachedResource): Promise<Map<string, Buffer>> {
        return this.repository.fetch(resource);
    }


    downloadAnnotationFile(uri: string): Promise<string> {
        return this.repository.downloadAnnotationFile(uri);
    }
}
