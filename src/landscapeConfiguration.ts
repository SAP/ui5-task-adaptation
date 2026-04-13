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
import LocalAnnotationManager from "./annotations/localAnnotationManager.js";
import { validateObject } from "./util/commonUtil.js";
import CFAnnotationManager from "./annotations/cfAnnotationManager.js";


export function initialize(configuration: IConfiguration): {
    adapter: IAdapter,
    repository: IRepository,
    annotationManager: IAnnotationManager
} {
    validateObject(configuration, ["type"], "should be specified in ui5.yaml configuration: 'cf' or 'abap'");
    const repository = getRepository(configuration);
    const annotationManager = getAnnotationManager(configuration, repository);
    return {
        adapter: getAdapter(configuration, annotationManager),
        repository,
        annotationManager
    };
}


function getAdapter(configuration: IConfiguration, annotationManager: IAnnotationManager): IAdapter {
    if (isPreview(configuration)) {
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
    if (isLocal(configuration)) {
        return new LocalRepository(configuration);
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
    if (isLocal(configuration)) {
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


function isLocal(configuration: IConfiguration) {
    return process.env.ADP_BUILDER_MODE === "local" || configuration.mode === "local";
}

function isPreview(configuration: IConfiguration) {
    return process.env.ADP_BUILDER_MODE === "preview" || configuration.mode === "preview";
}
