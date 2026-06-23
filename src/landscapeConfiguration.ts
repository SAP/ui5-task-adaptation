import { IConfiguration } from "./model/types.js";
import { IAdapter } from "./adapters/adapter.js";
import AbapAdapter from "./adapters/abapAdapter.js";
import CFAdapter from "./adapters/cfAdapter.js";
import PreviewAdapter from "./adapters/previewAdapter.js";
import IRepository from "./repositories/repository.js";
import AbapRepository from "./repositories/abapRepository.js";
import HTML5Repository from "./repositories/html5Repository.js";
import LocalRepository from "./repositories/localRepository.js";
import IAnnotationManager from "./annotations/annotationManager.js";
import AbapAnnotationManager from "./annotations/abapAnnotationManager.js";
import CFAnnotationManager from "./annotations/cfAnnotationManager.js";
import CFValidator from "./util/validator/cfValidator.js";
import AbapValidator from "./util/validator/abapValidator.js";
import IValidator, { isOneOf } from "./util/validator/validator.js";
import { LANDSCAPE_TYPES, LandscapeType } from "./model/configuration.js";
import { getLogger } from "@ui5/logger";
import LocalAnnotationManager from "./annotations/localAnnotationManager.js";

const log = getLogger("@ui5/task-adaptation::LandscapeConfiguration");


export function initialize(configuration: IConfiguration): {
    adapter: IAdapter,
    repository: IRepository,
    annotationManager: IAnnotationManager
} {
    const type = getTypeByConfiguration(configuration);
    const enhancedConfig = { ...configuration, type };
    const repository = getRepository(enhancedConfig);
    const annotationManager = getAnnotationManager(enhancedConfig, repository);
    return {
        adapter: getAdapter(enhancedConfig, annotationManager),
        repository,
        annotationManager
    };
}


function getTypeByConfiguration(configuration: IConfiguration): LandscapeType {
    const validators = [
        new CFValidator(),
        new AbapValidator(),
    ] as IValidator[];

    if (isOneOf(LANDSCAPE_TYPES, configuration.type)) {
        return configuration.type;
    } else {
        log.warn("Deprecated behavior: type is not specified or invalid. Should be either 'cf' or 'abap'. Trying to detect the type based on provided configuration");
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


function getAdapter(configuration: IConfiguration, annotationManager: IAnnotationManager): IAdapter {
    if (isPreview()) {
        return new PreviewAdapter(configuration);
    }
    switch (configuration.type) {
        case "abap":
            return new AbapAdapter(annotationManager);
        case "cf":
            return new CFAdapter(configuration);
        default:
            throw new Error(`No adapter found for the given configuration type '${configuration.type}'`);
    }
}


function getRepository(configuration: IConfiguration): IRepository {
    if (isLocal()) {
        return new LocalRepository();
    }
    switch (configuration.type) {
        case "abap":
            return new AbapRepository(configuration);
        case "cf":
            return new HTML5Repository(configuration);
        default:
            throw new Error(`No repository found for the given configuration type '${configuration.type}'`);
    }
}


function getAnnotationManager(configuration: IConfiguration, repository: IRepository): IAnnotationManager {
    if (isLocal()) {
        return new LocalAnnotationManager();
    }
    switch (configuration.type) {
        case "abap":
            return new AbapAnnotationManager(configuration, repository);
        case "cf":
            return new CFAnnotationManager();
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
