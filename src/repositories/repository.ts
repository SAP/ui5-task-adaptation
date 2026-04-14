import { IAppVariantIdHierarchyItem } from "../model/appVariantIdHierarchyItem.js";
import { IReuseLibInfo } from "../model/types.js";

export default interface IRepository {
    getAppVariantIdHierarchy(appId: string): Promise<IAppVariantIdHierarchyItem[]>;
    fetch(repoName: string, cachebusterToken: string): Promise<Map<string, string>>;
    fetchReuseLib(libName: string, cachebusterToken: string, lib: IReuseLibInfo): Promise<Map<string, string>>
    downloadAnnotationFile(uri: string): Promise<Map<string, string>>;
}
