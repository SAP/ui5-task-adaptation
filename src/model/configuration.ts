import { AbapTarget } from "@sap-ux/system-access";

export interface IConfiguration {
    appHostId?: string;
    appId?: string;
    appName?: string;
    appVersion?: string;
    space?: string;
    org?: string;
    sapCloudService?: string;
    destination?: string;
    type?: "cf" | "abap";
    mode?: "preview" | "local" | "default";
    languages?: any[] | undefined;
    enableAnnotationCache?: boolean;
    enableBetaFeatures?: boolean;
    writeTempFiles?: any;
    target?: AbapTarget & IAbapTargetMeta;
    serviceInstanceName?: string;
    adpDir?: string;
}

export interface IAbapTargetMeta {
    name?: string;
    ignoreCertErrors?: boolean;
}
