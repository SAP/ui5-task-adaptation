import { AbapTarget } from "@sap-ux/system-access";

export interface IConfiguration {
    appHostId?: string;
    appId?: string;
    appName?: string;
    appVersion?: string;
    spaceGuid?: string;
    orgGuid?: string;
    sapCloudService?: string;
    destination?: string;
    type?: "cf" | "abap";
    languages?: any[] | undefined;
    enableAnnotationCache?: boolean;
    enableBetaFeatures?: boolean;
    writeTempFiles?: any;
    connections?: (AbapTarget & IAbapTargetMeta)[]
}

export interface IAbapTargetMeta {
    name?: string;
    ignoreCertErrors?: boolean;
}
