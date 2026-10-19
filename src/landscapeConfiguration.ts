import { IConfiguration, IInitializeOptions } from "./model/types.js";
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


export async function initialize(configuration: IConfiguration, options: IInitializeOptions = {}): Promise<{
    adapter: IAdapter,
    repository: IRepository,
    annotationManager: IAnnotationManager
}> {
    const type = await getTypeByConfiguration(configuration);
    const enhancedConfig = { ...configuration, type };
    const repository = await getRepository(enhancedConfig, options);
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


/**
 * Per-landscape factories for the type-specific building blocks. Adding a new
 * landscape type is a single entry here instead of a new case in three parallel
 * switches. Imports stay lazy so only the active landscape's modules are loaded.
 */
interface LandscapeFactory {
    adapter(configuration: IConfiguration, annotationManager: IAnnotationManager): Promise<IAdapter>;
    repository(configuration: IConfiguration): Promise<IRepository>;
    annotationManager(configuration: IConfiguration, repository: IRepository): Promise<IAnnotationManager>;
}

const LANDSCAPE_FACTORIES: Record<LandscapeType, LandscapeFactory> = {
    abap: {
        adapter: async (_configuration, annotationManager) => {
            const { default: AbapAdapter } = await import("./adapters/abapAdapter.js");
            return new AbapAdapter(annotationManager);
        },
        repository: async (configuration) => {
            const { default: AbapRepository } = await import("./repositories/abapRepository.js");
            return new AbapRepository(configuration);
        },
        annotationManager: async (configuration, repository) => {
            const { default: AbapAnnotationManager } = await import("./annotations/abapAnnotationManager.js");
            return new AbapAnnotationManager(configuration, repository);
        },
    },
    cf: {
        adapter: async (configuration) => {
            const { default: CFAdapter } = await import("./adapters/cfAdapter.js");
            return new CFAdapter(configuration);
        },
        repository: async (configuration) => {
            const { default: HTML5Repository } = await import("./repositories/html5Repository.js");
            return new HTML5Repository(configuration);
        },
        annotationManager: async () => {
            const { default: CFAnnotationManager } = await import("./annotations/cfAnnotationManager.js");
            return new CFAnnotationManager();
        },
    },
};


function landscapeFactory(configuration: IConfiguration): LandscapeFactory {
    const factory = LANDSCAPE_FACTORIES[configuration.type as LandscapeType];
    if (!factory) {
        throw new Error(`No landscape factory found for the given configuration type '${configuration.type}'`);
    }
    return factory;
}


async function getAdapter(configuration: IConfiguration, annotationManager: IAnnotationManager): Promise<IAdapter> {
    if (isPreview()) {
        const { default: PreviewAdapter } = await import("./adapters/previewAdapter.js");
        return new PreviewAdapter(configuration);
    }
    return landscapeFactory(configuration).adapter(configuration, annotationManager);
}


async function getRepository(configuration: IConfiguration, options: IInitializeOptions): Promise<IRepository> {
    if (options.useCacheRepository) {
        const { default: CacheRepository } = await import("./repositories/cacheRepository.js");
        return new CacheRepository(configuration);
    }
    if (isLocal()) {
        const { default: LocalRepository } = await import("./repositories/localRepository.js");
        return new LocalRepository();
    }
    return landscapeFactory(configuration).repository(configuration);
}


async function getAnnotationManager(configuration: IConfiguration, repository: IRepository): Promise<IAnnotationManager> {
    if (isLocal()) {
        return new LocalAnnotationManager();
    }
    return landscapeFactory(configuration).annotationManager(configuration, repository);
}


function isLocal() {
    return process.env.ADP_BUILDER_MODE === "local";
}


function isPreview() {
    return process.env.ADP_BUILDER_MODE === "preview";
}
