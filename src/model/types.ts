import TaskUtil from "@ui5/builder/lib/tasks/TaskUtil";
import { DuplexCollection } from "@ui5/fs/lib";

export interface IConfiguration {
    appHostId?: string;
    appId?: string;
    appName?: string;
    appVersion?: string;
    spaceGuid?: string;
    orgGuid?: string;
    html5RepoRuntimeGuid?: string;
    sapCloudService?: string;
}

export interface IProjectOptions {
    configuration: IConfiguration;
    projectNamespace: string;
}

export interface ICreateServiceInstanceParams {
    spaceGuid: string;
    planName: string;
    name: string;
    tags: string[];
}

export interface IGetServiceInstanceParams {
    [key: string]: string[] | undefined;
    spaceGuids?: string[];
    planNames?: string[];
    names: string[];
}

export interface IServiceInstance {
    name: string;
    guid: string;
}

export interface IResource {
    name: string;
    guid: string;
    tags: string[];
    visibility_type: string;
}

export interface IServiceKeys {
    credentials: ICredentials;
    serviceInstance: IServiceInstance;
}

export interface ICredentials {
    [key: string]: any;
    uaa: IUaa;
    uri: string;
    endpoints: any;
}

export interface IUaa {
    clientid: string;
    clientsecret: string;
    url: string;
}

export interface IAppVariantInfo {
    id: string;
    reference: string;
    manifest: IAppVariantManifest;
}

export interface IAppVariantManifest {
    id: string;
    reference: string;
    content: IChange[];
}

export interface IChange {
    changeType: string;
    texts: IChangeText;
}

export interface IChangeText {
    i18n: string;
}

export interface ITaskParameters {
    workspace: DuplexCollection;
    options: IProjectOptions;
    taskUtil: TaskUtil;
}

export interface IBaseAppInfo {
    filepath: string;
    content: IBaseAppManifest;
}

export type IBaseAppManifest = {
    ["sap.platform.cf"]: {
        oAuthScopes: string[]
    };
    ["sap.cloud"]?: {
        service?: string
    };
    ["sap.app"]: {
        id: string;
        i18n: {
            bundleUrl: string;
            enhanceWith?: {
                bundleName: string
            }[]
        },
        applicationVersion: {
            version: string;
        }
    };
    ["sap.ui5"]: {
        appVariantIdHierarchy: {
            appVariantId: string;
            version: string;
        }[]
    }
};

export type KeyedMap<T, K extends keyof T, V> = { [k in K]: V };