import * as dotenv from "dotenv";

import { bufferToJson, logBuilderVersion } from "./util/commonUtil.js";

import AppVariant from "./appVariant.js";
import BaseApp from "./baseApp.js";
import CacheHolder from "./cache/cacheHolder.js";
import ResourceUtil from "./util/resourceUtil.js";
import ReferencesBuilder from "./util/referencesBuilder.js";
import { ITaskParameters, UI5BuilderTools } from "./model/types.js";
import { initialize } from "./landscapeConfiguration.js";
import IRepository from "./repositories/repository.js";
import { IAdapter } from "./adapters/adapter.js";


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

    const { adapter, repository } = await initialize(options.configuration);
    const adaptationProject = await AppVariant.fromWorkspace(workspace, options.projectNamespace);

    const { files: baseFiles } = await foldBaseHierarchy(adapter, repository, adaptationProject.reference);
    await CacheHolder.write(CacheHolder.mergedResource(adaptationProject.reference), new Map(baseFiles));

    const files = await adapter.createAdaptCommandChain(baseFiles, adaptationProject).execute();

    const references = new ReferencesBuilder()
        .addReferences(files, adaptationProject.id)
        .build();
    return adapter.createPostCommandChain(references, adaptationProject, ui5BuilderTools).execute(files);
};


/**
 * Produces the manifest.json a full build would produce, without a full UI5 build.
 */
export async function previewManifest({ workspace, options }: ITaskParameters): Promise<any> {
    const { adapter, repository } = await initialize(options.configuration, { useCache: true });
    const adaptationProject = await AppVariant.fromWorkspace(workspace, options.projectNamespace);

    const { files: baseFiles } = await foldBaseHierarchy(adapter, repository, adaptationProject.reference);
    await CacheHolder.write(CacheHolder.mergedResource(adaptationProject.reference), new Map(baseFiles));

    const baseApp = BaseApp.fromFiles(baseFiles);
    const references = new ReferencesBuilder()
        .addReference(adaptationProject.reference, adaptationProject.id)
        .addReferences(baseFiles, adaptationProject.id)
        .build();

    const files = new Map(baseFiles);
    await adapter.createManifestPreviewCommandChain(baseApp, adaptationProject, references).execute(files, "manifest.json");
    return bufferToJson(files.get("manifest.json")!);
}


/**
 * Downloads the base app and all resources along the app-variant hierarchy and writes the merged files to `outputDir`.
 */
export async function downloadAppResources({ workspace, options }: ITaskParameters, outputDir: string): Promise<void> {
    const { adapter, repository } = await initialize(options.configuration);
    const adaptationProject = await AppVariant.fromWorkspace(workspace, options.projectNamespace);

    const { files } = await foldBaseHierarchy(adapter, repository, adaptationProject.reference);
    await ResourceUtil.write(outputDir, new Map(files));
}

async function foldBaseHierarchy(adapter: IAdapter, repository: IRepository, reference: string): Promise<{ files: ReadonlyMap<string, Buffer> }> {
        await adapter.createSetupCommandChain(reference, repository).execute();
        const hierarchy = await repository.getAppVariantIdHierarchy(reference);
        if (hierarchy.length === 0) {
            throw new Error(`No app variant found for reference ${reference}`);
        }
        const fetchFilesPromises = hierarchy.toReversed()
            .map(variant => repository.fetch(variant)) as Promise<ReadonlyMap<string, Buffer>>[];

        let files = await fetchFilesPromises.shift()!; // original base app files
        for (const filesPromise of fetchFilesPromises) {
            const appVariant = AppVariant.fromFiles(await filesPromise);
            files = await adapter.createAdaptCommandChain(files, appVariant).execute();
        }
        return { files };
    }