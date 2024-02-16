import Language from "./language";

export interface IConfiguration {
    writeTempFiles?: any;
    appHostId?: string;
    appId?: string;
    appName?: string;
    appVersion?: string;
    spaceGuid?: string;
    orgGuid?: string;
    sapCloudService?: string;
    destination?: string;
    credentials?: IAuth;
    type?: "cf" | "abap";
    languages?: any[] | undefined;
    enableAnnotationCache?: boolean;
    enableBetaFeatures?: boolean;
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
    layer?: string;
    changes: IChange[];
}

export interface IAppVariantManifest {
    id: string;
    reference: string;
    layer?: string;
    content: IChange[];
}

export interface IChange {
    changeType: string;
    texts?: IChangeText;
    layer?: string;
    content?: IChangeContent;
}

export interface IChangeText {
    i18n: string;
}

export interface IChangeContent {
    bundleUrl?: string;
    fallbackLocale?: string;
    modelId?: string;
    supportedLocales?: string[];
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

export interface IHTML5RepoInfo {
    token: string;
    baseUri: string;
}

export interface IAuth {
    username: string;
    password: string;
}

export interface IMetadata {
    changedOn: string;
    id?: string;
}

export type KeyedMap<T, K extends keyof T, V> = { [k in K]: V };

export interface IJsonPerLanguage {
    language: Language;
    json: any;
}

export interface IJsonPromisePerLanguage {
    language: Language;
    json: Promise<any>;
}
