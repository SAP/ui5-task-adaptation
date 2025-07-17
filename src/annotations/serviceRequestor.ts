import AbapRepoManager from "../repositories/abapRepoManager.js";
import { IConfiguration } from "../model/types.js";
import Language from "../model/language.js";
import ServerError from "../model/serverError.js";
import { getLogger } from "@ui5/logger";
import { writeTempAnnotations } from "../util/commonUtil.js";

const log = getLogger("@ui5/task-adaptation::ServiceRequestor");

function retryOnError(maxRetries: number): MethodDecorator {
    return (_target: any, _propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
        const originalMethod = descriptor.value;

        descriptor.value = async function (...args: any[]) {
            let retries = 0;
            while (true) {
                try {
                    return await originalMethod.apply(this, args);
                } catch (error: any) {
                    if (error instanceof ServerError) {
                        if (retries === maxRetries) {
                            throw new Error(`Error occurred: ${error.message}. Please try again if this is a temporary issue. If not, please create a ticket on CA-UI5-ABA-AIDX`);
                        }
                        retries++;
                    } else {
                        const message = error?.response?.data ?? error.message;
                        throw new Error(`Failed to fetch annotation by '${args[0]}': ${message}`);
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

    //@ts-ignore tsx (esbuild) is not yet implemented the new decorators, but
    //old decorators are already subject of compiler error, but it works. So we
    //wait till esbuild implement it correctly.
    @retryOnError(1)
    async downloadAnnotation(uri: string, name: string, language: Language): Promise<string> {
        uri += `?sap-language=${language.sap}`;
        log.verbose(`Getting annotation '${name}' ${language} by '${uri}'`);
        let files = await this.abapRepoManager.downloadAnnotationFile(uri);
        if (!files || files.size === 0) {
            throw new Error(`No files were fetched for '${name}' by '${uri}'`);
        }
        const xml = [...files][0][1];
        writeTempAnnotations(this.configuration, name, language, xml);
        return xml;
    }
}
