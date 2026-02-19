import * as dotenv from "dotenv";

import { logBuilderVersion } from "./util/commonUtil.js";

import AppVariant from "./appVariantManager.js";
import BaseApp from "./baseAppManager.js";
import { ITaskParameters } from "./model/types.js";
import ResourceUtil from "./util/resourceUtil.js";
import { determineProcessor } from "./processors/processor.js";
import FilesUtil from "./util/filesUtil.js";

/**
 * Creates an appVariant bundle from the provided resources.
 */
export default ({ workspace, options, taskUtil }: ITaskParameters) => {

    dotenv.config();

    async function process(workspace: IWorkspace, taskUtil: any) {
        logBuilderVersion();

        const processor = determineProcessor(options.configuration);
        const adapter = processor.getAdapter();

        const adaptationProject = await AppVariant.fromWorkspace(workspace, options.projectNamespace);
        const appVariantIdHierarchy = await processor.getAppVariantIdHierarchy(adaptationProject.reference);
        if (appVariantIdHierarchy.length === 0) {
            throw new Error(`No app variant found for reference ${adaptationProject.reference}`);
        }

        // appVariantIdHierarchy contains original application on bottom and the
        // latest app variant on top. We reverse the list to process original
        // application first and then app variants in chronological order.
        const reversedHierarchy = appVariantIdHierarchy.toReversed();
        const fetchFilesPromises: Promise<ReadonlyMap<string, string> | null>[] = reversedHierarchy.map(({ repoName, cachebusterToken }) => processor.fetch(repoName, cachebusterToken));
        fetchFilesPromises.push(Promise.resolve(adaptationProject.files));
        const appVariants = new Array<AppVariant>();

        const adapt = async (baseAppFiles: ReadonlyMap<string, string> | null, appVariantFiles: ReadonlyMap<string, string> | null) => {
            let baseApp = BaseApp.fromFiles(baseAppFiles!);
            let appVariant = AppVariant.fromFiles(appVariantFiles!);
            // If the app variant is the same as the adaptation project, we use the
            // adaptation project because it contains resources that should be updated.
            if (appVariant.id === adaptationProject.id) {
                appVariant = adaptationProject;
            }
            appVariants.push(appVariant);
            const adaptedFiles = await baseApp.adapt(appVariant, processor);
            const mergeCommandChain = adapter.createMergeCommandChain(baseApp, appVariant);
            const mergedFiles = await mergeCommandChain.execute(adaptedFiles, appVariant.getProcessedFiles());
            return mergedFiles;
        }

        let files = await fetchFilesPromises.reduce(async (previousFiles, currentFiles) =>
            adapt(await previousFiles, await currentFiles), fetchFilesPromises.shift()!);

        const references = getReferences(appVariants, adaptationProject.id);
        files = FilesUtil.filter(files!);
        files = FilesUtil.rename(files, references);

        adaptationProject.omitDeletedResources(files, options.projectNamespace, taskUtil);
        const writePromises = new Array<Promise<void>>();
        files!.forEach((content, filename) => {
            const resource = ResourceUtil.createResource(filename, options.projectNamespace, content);
            writePromises.push(workspace.write(resource));
        });
        await Promise.all(writePromises);
    }

    return process(workspace, taskUtil);

    /**
     * 4p. Reference map contains searchTerm as key and replacement as value. Base
     * id and app variant ids are renamed to adaptation project id.
     */
    function getReferences(appVariants: AppVariant[], adaptationProjectId: string): Map<string, string> {
        const references = new Map<string, string>();
        appVariants.forEach((variant, i) => {
            if (i === 0) {
                references.set(variant.reference, adaptationProjectId);
            }
            if (variant.id !== adaptationProjectId) {
                references.set(variant.id, adaptationProjectId);
            }
            variant.getRenamingForMovedFiles().forEach((value, key) => references.set(key, value));
        });
        return references;
    }
}