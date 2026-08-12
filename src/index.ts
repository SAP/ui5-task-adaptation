import * as dotenv from "dotenv";

import { bufferToString, getReferences, logBuilderVersion } from "./util/commonUtil.js";

import AppVariant from "./appVariant.js";
import BaseApp from "./baseApp.js";
import { ITaskParameters, UI5BuilderTools } from "./model/types.js";
import { initialize } from "./landscapeConfiguration.js";

/**
 * Creates an appVariant bundle from the provided resources.
 */
export default async ({ workspace, options, taskUtil }: ITaskParameters) => {

    const ui5BuilderTools = {
        workspace,
        projectNamespace: options.projectNamespace,
        taskUtil,
    } as UI5BuilderTools;

    dotenv.config();
    logBuilderVersion();

    const { repository, adapter } = await initialize(options.configuration);
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
    const fetchFilesPromises = reversedHierarchy.map(variant => repository.fetch(variant)) as Promise<ReadonlyMap<string, Buffer>>[];

    const appVariants = new Array<AppVariant>();
    const adapt = async (baseFiles: ReadonlyMap<string, Buffer>, appVariant: AppVariant) => {
        appVariants.push(appVariant);
        const baseApp = BaseApp.fromFiles(baseFiles);
        return adapter.createAdaptCommandChain(baseApp, appVariant).execute();
    };

    let files = await fetchFilesPromises.shift()!; // original app files
    for (const appVariantFilesPromise of fetchFilesPromises) {
        const appVariantFiles = await appVariantFilesPromise;
        files = await adapt(files, AppVariant.fromFiles(appVariantFiles));
    }

    files = await adapt(files, adaptationProject);

    const references = getReferences(appVariants, adaptationProject.id);
    return adapter.createPostCommandChain(
        references,
        adaptationProject,
        ui5BuilderTools,
    ).execute(files);
};


/**
 * Preview-time entry point (CF only). Produces the same manifest.json a
 * full build would produce, without going to the HTML5 Repo.
 * Precondition is a full build must have run at least once so the base app
 * files are cached by the @cached() decorator on HTML5Repository.fetch. If
 * the cache is empty, this throws with a message directing the user to run
 * a full build first.
 */
export async function previewManifest({ workspace, options }: ITaskParameters): Promise<any> {
    const { repository, adapter } = await initialize(options.configuration, { useCacheRepository: true });
    const adaptationProject = await AppVariant.fromWorkspace(workspace, options.projectNamespace);
    const [baseAppResource] = await repository.getAppVariantIdHierarchy(adaptationProject.reference);
    const cachedBaseAppFiles = await repository.fetch(baseAppResource);
    const baseApp = BaseApp.fromFiles(cachedBaseAppFiles);

    const files = new Map(cachedBaseAppFiles);
    const manifestPreviewCommandChain = adapter.createManifestPreviewCommandChain(baseApp, adaptationProject);
    await manifestPreviewCommandChain.execute(files, "manifest.json");
    return JSON.parse(bufferToString(files.get("manifest.json")!));
}
