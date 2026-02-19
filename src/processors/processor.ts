import AbapProcessor from "./abapProcessor.js";
import AbapRepoManager from "../repositories/abapRepoManager.js";
import AnnotationManager from "../annotationManager.js";
import CFProcessor from "./cfProcessor.js";
import { IAppVariantIdHierarchyItem } from "../model/appVariantIdHierarchyItem.js"
import { IConfiguration, IReuseLibInfo } from "../model/types.js";
import { IAdapter } from "../adapters/adapter.js";
import PreviewProcessor from "./previewProcessor.js";

export default interface IProcessor {
    getAppVariantIdHierarchy(appId: string): Promise<IAppVariantIdHierarchyItem[]>;
    getAdapter(): IAdapter;
    fetch(repoName: string, cachebusterToken: string): Promise<Map<string, string>>;
    fetchReuseLib(repoName: string, cachebusterToken: string, lib: IReuseLibInfo): Promise<Map<string, string>>;
}


export function determineProcessor(configuration: IConfiguration): IProcessor {
    const abapRepoManager = new AbapRepoManager(configuration);
    const annotationManager = new AnnotationManager(configuration, abapRepoManager);
    const processors = [
        new CFProcessor(configuration),
        new AbapProcessor(configuration, abapRepoManager, annotationManager)
    ];
    if (isPreviewMode()) {
        const processor = new PreviewProcessor(configuration);
        processor.validateConfiguration();
        return processor;
    }
    let processor = processors.find(processor => processor.getConfigurationType() === configuration.type);
    if (processor) {
        processor.validateConfiguration();
        return processor;
    } else {
        for (const processor of processors) {
            try {
                processor.validateConfiguration();
                return processor;
            } catch (_error) {
                continue;
            }
        }
    }
    throw new Error("ui5.yaml configuration should correspond either ABAP or SAP BTP landscape");
}

function isPreviewMode(): boolean {
    return process.env.ADP_BUILDER_MODE === "preview";
}
