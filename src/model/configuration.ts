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
    mode?: LandscapeMode;
    languages?: any[] | undefined;
    enableAnnotationCache?: boolean;
    enableBetaFeatures?: boolean;
    writeTempFiles?: any;
    target?: AbapTarget & IAbapTargetMeta;
    serviceInstanceName?: string;
    adpDir?: string;
}

export const LANDSCAPE_TYPES = ["cf", "abap"] as const;
export type LandscapeType = typeof LANDSCAPE_TYPES[number]; // "cf" | "abap"
export const LANDSCAPE_MODES = ["preview", "local", "default"] as const;
export type LandscapeMode = typeof LANDSCAPE_MODES[number]; // "preview" | "local" | "default"

export interface IAbapTargetMeta {
    name?: string;
    ignoreCertErrors?: boolean;
}
