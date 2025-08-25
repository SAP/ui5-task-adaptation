import * as dotenv from "dotenv";

import { logBuilderVersion } from "./util/commonUtil.js";

import AppVariant from "./appVariantManager.js";
import BaseApp from "./baseAppManager.js";
import I18nMerger from "./util/i18nMerger.js";
import { ITaskParameters } from "./model/types.js";
import ResourceUtil from "./util/resourceUtil.js";
import { determineProcessor } from "./processors/processor.js";

/**
 * Creates an appVariant bundle from the provided resources.
 */
export default ({ workspace, options, taskUtil }: ITaskParameters) => {

    dotenv.config();

    async function process(workspace: IWorkspace, taskUtil: any) {
        logBuilderVersion();

        const processor = determineProcessor(options.configuration);

        const adaptationProject = await AppVariant.fromWorkspace(workspace, options.projectNamespace);
        const appVariantIdHierarchy = await processor.getAppVariantIdHierarchy(adaptationProject.reference);

        // appVariantIdHierarchy contains original application on bottom and the
        // latest app variant on top. We reverse the list to process original
        // application first and then app variants in chronological order.
        const reversedHierarchy = appVariantIdHierarchy.toReversed();
        const fetchFilesPromises: Promise<ReadonlyMap<string, string> | null>[] = reversedHierarchy.map(({ repoName, cachebusterToken }) => processor.fetch(repoName, cachebusterToken));
        fetchFilesPromises.push(Promise.resolve(adaptationProject.files));

        const adapt = async (baseAppFiles: ReadonlyMap<string, string> | null, appVariantFiles: ReadonlyMap<string, string> | null) => {
            const baseApp = BaseApp.fromFiles(baseAppFiles!);
            const appVariant = AppVariant.fromFiles(appVariantFiles!);
            const adaptedFiles = await baseApp.adapt(appVariant, processor);
            return I18nMerger.merge(adaptedFiles, baseApp.i18nPath, appVariant);
        }

        let files = await fetchFilesPromises.reduce(async (previousFiles, currentFiles) =>
            adapt(await previousFiles, await currentFiles), fetchFilesPromises.shift()!);

        adaptationProject.omitDeletedResources(files!, options.projectNamespace, taskUtil);
        const writePromises = new Array<Promise<void>>();
        files!.forEach((content, filename) => {
            const resource = ResourceUtil.createResource(filename, options.projectNamespace, content);
            writePromises.push(workspace.write(resource));
        });
        await Promise.all(writePromises);
    }

    return process(workspace, taskUtil);

}