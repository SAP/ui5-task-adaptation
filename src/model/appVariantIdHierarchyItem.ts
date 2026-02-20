export interface IAppVariantIdHierarchyItem {
    appVariantId: string;
    repoName: string;
    cachebusterToken: string;
}

export interface IAppVariantIdHierarchyManifestItem {
    appVariantId: string;
    version: string;
    layer?: "VENDOR";
}

