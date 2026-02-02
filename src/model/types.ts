import { IConfiguration } from "./configuration.js";
import Language from "./language.js";

export interface IProjectOptions {
    configuration: IConfiguration;
    projectNamespace: string;
}

export interface ICreateServiceInstanceParams {
    spaceGuid: string;
    planName: string;
    serviceName: string;
    serviceInstanceName: string;
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
    filename: string;
}

export interface IChangeText {
    i18n: string;
}

export interface IChangeContent {
    dataSource?: any;
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

export interface IReuseLibInfo {
	name: string;
	lazy: boolean;
	html5AppHostId: string;
	html5AppName: string;
	html5AppVersion: string;
	html5CacheBusterToken: string;
	url: {
		uri: string;
		final: boolean;
	}
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

export { IConfiguration };
