export interface IConfiguration {
    appHostId?: string;
    appId?: string;
    appName?: string;
    appVersion?: string;
    spaceGuid?: string;
    orgGuid?: string;
    sapCloudService?: string;
}

export interface IProjectOptions {
    configuration: IConfiguration;
    projectNamespace: string;
}

export interface ICreateServiceInstanceParams {
    spaceGuid: string;
    planName: string;
    serviceName: string;
    serviceInstanceName?: string;
    tags: string[];
    parameters?: any;
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
    workspace: any;
    options: IProjectOptions;
    taskUtil: any;
}

export interface IBaseAppInfo {
    filepath: string;
    content: any;
}

export type KeyedMap<T, K extends keyof T, V> = { [k in K]: V };