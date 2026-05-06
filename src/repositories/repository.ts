import ICachedResource from "../cache/cachedResource.js";

export default interface IRepository {
    getAppVariantIdHierarchy(appId: string): Promise<ICachedResource[]>;
    fetch(resource: ICachedResource): Promise<Map<string, string>>;
    downloadAnnotationFile(uri: string): Promise<Map<string, string>>;
}
