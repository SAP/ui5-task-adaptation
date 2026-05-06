import * as dotenv from "dotenv";

import { getReferences, logBuilderVersion } from "./util/commonUtil.js";

import AppVariant from "./appVariantManager.js";
import BaseApp from "./baseAppManager.js";
import { ITaskParameters, UI5BuilderTools } from "./model/types.js";
import { initialize } from "./landscapeConfiguration.js";

/**
 * Creates an appVariant bundle from the provided resources.
 */
export default async ({ workspace, options, taskUtil }: ITaskParameters) => {

    dotenv.config();
    logBuilderVersion();

    const { repository, adapter } = initialize(options.configuration);
    const adaptationProject = await AppVariant.fromWorkspace(workspace, options.projectNamespace);
    const setupCommandChain = adapter.createSetupCommandChain(adaptationProject.reference, repository);
    await setupCommandChain.execute();

    const appVariantIdHierarchy = await repository.getAppVariantIdHierarchy(adaptationProject.reference);
    if (appVariantIdHierarchy.length === 0) {
        throw new Error(`No app variant found for reference ${adaptationProject.reference}`);
    }

    // appVariantIdHierarchy contains original application on bottom and the
    // latest app variant on top. We reverse the list to process original
    // application first and then app variants in chronological order.
    const reversedHierarchy = appVariantIdHierarchy.toReversed();
    const fetchFilesPromises: Promise<ReadonlyMap<string, string>>[] = reversedHierarchy.map(variant => repository.fetch(variant));
    fetchFilesPromises.push(Promise.resolve(adaptationProject.files));
    const appVariants = new Array<AppVariant>();

    const adapt = async (baseAppFiles: ReadonlyMap<string, string>, appVariantFiles: ReadonlyMap<string, string>): Promise<ReadonlyMap<string, string>> => {
        let baseApp = BaseApp.fromFiles(baseAppFiles);
        let appVariant = AppVariant.fromFiles(appVariantFiles);
        // If the app variant is the same as the adaptation project, we use the
        // adaptation project because it contains resources that should be updated.
        if (appVariant.id === adaptationProject.id) {
            appVariant = adaptationProject;
        }
        appVariants.push(appVariant);
        const adaptCommandChain = adapter.createAdaptCommandChain(baseApp, appVariant);
        const mergeCommandChain = adapter.createMergeCommandChain(baseApp, appVariant);
        const adaptedFiles = await adaptCommandChain.execute();
        const mergedFiles = await mergeCommandChain.execute(adaptedFiles);
        return mergedFiles;
    }

    let files = await fetchFilesPromises.reduce(async (previousFiles, currentFiles) =>
        adapt(await previousFiles, await currentFiles), fetchFilesPromises.shift()!);

    const references = getReferences(appVariants, adaptationProject.id);
    const ui5BuilderTools = {
        workspace,
        taskUtil,
        projectNamespace: options.projectNamespace
    } as UI5BuilderTools;
    return adapter.createPostCommandChain(
        references,
        adaptationProject,
        ui5BuilderTools,
    ).execute(files);

}
