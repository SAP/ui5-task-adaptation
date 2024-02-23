import AbapRepoManager from "../repositories/abapRepoManager";
import AnnotationsCacheManager from "../cache/annotationsCacheManager";
import { IConfiguration } from "../model/types";
import Language from "../model/language";
import ServerError from "../model/serverError";
import { writeTempAnnotations } from "../util/commonUtil";

const log = require("@ui5/logger").getLogger("@ui5/task-adaptation::ServiceRequestor");

function retryOnError(maxRetries: number): MethodDecorator {
    return (_target: any, _propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
        const originalMethod = descriptor.value;

        descriptor.value = async function (...args: any[]) {
            let retries = 0;
            while (true) {
                try {
                    const result = await originalMethod.apply(this, args);
                    return result;
                } catch (error: any) {
                    if (error instanceof ServerError) {
                        if (retries === maxRetries) {
                            throw new Error(`Error occurred: ${error.message}. Please try again if this is a temporary issue. If not, please create a ticket on CA-UI5-ABA-AIDX`);
                        }
                        retries++;
                    } else {
                        throw new Error(`Failed to fetch annotation by '${args[0]}': ${error.message}`);
                    }
                }
            }
        };
        return descriptor;
    };
}

export default class ServiceRequestor {
    private abapRepoManager: AbapRepoManager;
    private configuration: IConfiguration;

    constructor(configuration: IConfiguration, abapRepoManager: AbapRepoManager) {
        this.abapRepoManager = abapRepoManager;
        this.configuration = configuration;
    }

    @retryOnError(1)
    async downloadAnnotation(uri: string, name: string, language: Language): Promise<string> {
        let cacheName = name;
        if (language.sap) {
            uri += `?sap-language=${language.sap}`;
            cacheName += `-${language.sap}`;
        }
        const cacheManager = new AnnotationsCacheManager(this.configuration, cacheName);
        log.verbose(`Getting annotation '${cacheName}' ${language} by '${uri}'`);
        let files;
        if (this.configuration.enableAnnotationCache) {
            files = await cacheManager.getFiles(
                () => this.abapRepoManager.getAnnotationMetadata(uri),
                () => this.abapRepoManager.downloadAnnotationFile(uri));
        } else {
            files = await this.abapRepoManager.downloadAnnotationFile(uri);
        }
        if (!files || files.size === 0) {
            throw new Error(`No files were fetched for '${name}' by '${uri}'`);
        }
        const xml = [...files][0][1];
        writeTempAnnotations(this.configuration, name, language, xml);
        return xml;
    }
}
