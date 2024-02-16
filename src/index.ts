import * as dotenv from "dotenv";

import { logBetaUsage, logBuilderVersion } from "./util/commonUtil";

import AppVariantManager from "./appVariantManager";
import BaseAppManager from "./baseAppManager";
import I18NMerger from "./util/i18nMerger";
import { ITaskParameters } from "./model/types";
import { determineProcessor } from "./processors/processor";

/**
 * Creates an appVariant bundle from the provided resources.
 */
module.exports = ({ workspace, options, taskUtil }: ITaskParameters) => {

    dotenv.config();

    async function process(workspace: any, taskUtil: any) {
        await logBuilderVersion();
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