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
    type?: LandscapeType;
    languages?: any[] | undefined;
    enableAnnotationCache?: boolean;
    enableBetaFeatures?: boolean;
    writeTempFiles?: any;
    target?: AbapTarget & IAbapTargetMeta;
    serviceInstanceName?: string;
}

export const LANDSCAPE_TYPES = ["cf", "abap"] as const;
export type LandscapeType = typeof LANDSCAPE_TYPES[number]; // "cf" | "abap"

export interface IAbapTargetMeta {
    name?: string;
    ignoreCertErrors?: boolean;
}
