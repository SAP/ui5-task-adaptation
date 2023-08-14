import AbapProcessor from "./abapProcessor";
import AbapRepoManager from "../repositories/abapRepoManager";
import AnnotationManager from "../annotationManager";
import BaseAppFilesCacheManager from "../cache/baseAppFilesCacheManager";
import CFProcessor from "./cfProcessor";
import { IConfiguration } from "../model/types";

export default interface IProcessor {

    createAppVariantHierarchyItem(appVariantId: string, version: string): void;
    getBaseAppFiles(baseAppId: string): Promise<Map<string, string>>;
    updateLandscapeSpecificContent(renamedBaseAppManifest: any, baseAppFiles?: Map<string, string>): Promise<void>;

}


export function determineProcessor(configuration: IConfiguration): IProcessor {
    const cacheManager = new BaseAppFilesCacheManager(configuration);
    const abapRepoManager = new AbapRepoManager(configuration);
    const annotationManager = new AnnotationManager(configuration, abapRepoManager);
    const processors = [
        new CFProcessor(configuration, cacheManager),
        new AbapProcessor(configuration, cacheManager, abapRepoManager, annotationManager)
    ];
    let processor = processors.find(processor => processor.getConfigurationType() === configuration.type);
    if (processor) {
        processor.validateConfiguration();
        return processor;
    } else {
        for (const processor of processors) {
            try {
                processor.validateConfiguration();
                return processor;
            } catch (error) {
                continue;
            }
        }
    }
    throw new Error("ui5.yaml configuration should correspond either ABAP or SAP BTP landscape");
}
