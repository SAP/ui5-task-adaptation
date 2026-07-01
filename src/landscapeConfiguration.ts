import { IConfiguration } from "./model/types.js";
import { IAdapter } from "./adapters/adapter.js";
import IRepository from "./repositories/repository.js";
import IAnnotationManager from "./annotations/annotationManager.js";
import CFValidator from "./util/validator/cfValidator.js";
import IValidator, { isOneOf } from "./util/validator/validator.js";
import { LANDSCAPE_TYPES, LandscapeType } from "./model/configuration.js";
import { getLogger } from "@ui5/logger";
import AbapValidator from "./util/validator/abapValidator.js";
import LocalAnnotationManager from "./annotations/localAnnotationManager.js";

const log = getLogger("@ui5/task-adaptation::LandscapeConfiguration");


export async function initialize(configuration: IConfiguration): Promise<{
    adapter: IAdapter,
    repository: IRepository,
    annotationManager: IAnnotationManager
}> {
    const type = await getTypeByConfiguration(configuration);
    const enhancedConfig = { ...configuration, type };
    const repository = await getRepository(enhancedConfig);
    const annotationManager = await getAnnotationManager(enhancedConfig, repository);
    return {
        adapter: await getAdapter(enhancedConfig, annotationManager),
        repository,
        annotationManager
    };
}


async function getTypeByConfiguration(configuration: IConfiguration): Promise<LandscapeType> {
    if (isOneOf(LANDSCAPE_TYPES, configuration.type)) {
        return configuration.type;
    } else {
        log.warn("Deprecated behavior: type is not specified or invalid. Should be either 'cf' or 'abap'. Trying to detect the type based on provided configuration");
        const validators = [
            new CFValidator(),
            new AbapValidator(),
        ] as IValidator[];
        for (const validator of validators) {
            try {
                validator.validateConfiguration(configuration);
                return validator.type;
            } catch (_error) {
                // Continue to the next validator if validation fails
            }
        }
        throw new Error("'type' should be specified in ui5.yaml configuration: 'cf' or 'abap'");
    }
}


async function getAdapter(configuration: IConfiguration, annotationManager: IAnnotationManager): Promise<IAdapter> {
    if (isPreview()) {
        const { default: PreviewAdapter } = await import("./adapters/previewAdapter.js");
        return new PreviewAdapter(configuration);
    }
    switch (configuration.type) {
        case "abap": {
            const { default: AbapAdapter } = await import("./adapters/abapAdapter.js");
            return new AbapAdapter(annotationManager);
        }
        case "cf": {
            const { default: CFAdapter } = await import("./adapters/cfAdapter.js");
            return new CFAdapter(configuration);
        }
        default:
            throw new Error(`No adapter found for the given configuration type '${configuration.type}'`);
    }
}


async function getRepository(configuration: IConfiguration): Promise<IRepository> {
    if (isLocal()) {
        const { default: LocalRepository } = await import("./repositories/localRepository.js");
        return new LocalRepository();
    }
    switch (configuration.type) {
        case "abap": {
            const { default: AbapRepository } = await import("./repositories/abapRepository.js");
            return new AbapRepository(configuration);
        }
        case "cf": {
            const { default: HTML5Repository } = await import("./repositories/html5Repository.js");
            return new HTML5Repository(configuration);
        }
        default:
            throw new Error(`No repository found for the given configuration type '${configuration.type}'`);
    }
}


async function getAnnotationManager(configuration: IConfiguration, repository: IRepository): Promise<IAnnotationManager> {
    if (isLocal()) {
        return new LocalAnnotationManager();
    }
    switch (configuration.type) {
        case "abap": {
            const { default: AbapAnnotationManager } = await import("./annotations/abapAnnotationManager.js");
            return new AbapAnnotationManager(configuration, repository);
        }
        case "cf": {
            const { default: CFAnnotationManager } = await import("./annotations/cfAnnotationManager.js");
            return new CFAnnotationManager();
        }
        default:
            throw new Error(`No annotation manager found for the given configuration type '${configuration.type}'`);
    }
}


function isLocal() {
    return process.env.ADP_BUILDER_MODE === "local";
}


function isPreview() {
    return process.env.ADP_BUILDER_MODE === "preview";
}
