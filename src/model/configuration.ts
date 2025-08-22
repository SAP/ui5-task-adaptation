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
    languages?: any[] | undefined;
    enableAnnotationCache?: boolean;
    enableBetaFeatures?: boolean;
    writeTempFiles?: any;
    target?: AbapTarget & IAbapTargetMeta;
    serviceInstanceName?: string;
}

export interface IAbapTargetMeta {
    name?: string;
    ignoreCertErrors?: boolean;
}
