import * as dotenv from "dotenv";

import { logBetaUsage, logBuilderVersion } from "./util/commonUtil.js";

import AppVariantManager from "./appVariantManager.js";
import BaseAppManager from "./baseAppManager.js";
import I18NMerger from "./util/i18nMerger.js";
import { ITaskParameters } from "./model/types.js";
import { determineProcessor } from "./processors/processor.js";

/**
 * Creates an appVariant bundle from the provided resources.
 */
export default ({ workspace, options, taskUtil }: ITaskParameters) => {

    dotenv.config();

    async function process(workspace: any, taskUtil: any) {
        logBuilderVersion();
        logBetaUsage();
        const processor = determineProcessor(options.configuration);
        const appVariantResources = await AppVariantManager.getAppVariantResourcesToProcess(workspace);
        const appVariantInfo = await AppVariantManager.process(appVariantResources, options.projectNamespace, taskUtil);
        const baseAppFiles = await processor.getBaseAppFiles(appVariantInfo.reference);
        const { resources, manifestInfo } = await BaseAppManager.process(baseAppFiles, appVariantInfo, options, processor);
        const mergedResources = await I18NMerger.mergeI18NFiles(resources, appVariantResources, options.projectNamespace, manifestInfo.i18nPath, appVariantInfo, taskUtil);
        await Promise.all(mergedResources.map(resource => workspace.write(resource)));
    }

    return process(workspace, taskUtil);

}