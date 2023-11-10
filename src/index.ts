import * as dotenv from "dotenv";

import AppVariantManager from "./appVariantManager";
import BaseAppManager from "./baseAppManager";
import { ITaskParameters } from "./model/types";
import { determineProcessor } from "./processors/processor";

/**
 * Creates an appVariant bundle from the provided resources.
 */
module.exports = ({ workspace, options, taskUtil }: ITaskParameters) => {

    dotenv.config();

    async function process(workspace: any, taskUtil: any) {
        const processor = determineProcessor(options.configuration);
        const appVariantResources = await AppVariantManager.getAppVariantResources(workspace);
        const appVariantInfo = await AppVariantManager.process(appVariantResources, options.projectNamespace, taskUtil);
        const baseAppFiles = await processor.getBaseAppFiles(appVariantInfo.reference);
        const { resources } = await BaseAppManager.process(baseAppFiles, appVariantInfo, options, processor);
        await Promise.all(appVariantResources.concat(resources).map(resource => workspace.write(resource)));
    }

    return process(workspace, taskUtil);

}