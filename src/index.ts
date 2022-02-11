import AppVariantManager from "./appVariantManager";
import BaseAppManager from "./baseAppManager";
import { ITaskParameters } from "./model/types";
import updateCache from "./updateCache";

/**
 * Creates an appVariant bundle from the provided resources.
 */
module.exports = ({ workspace, options, taskUtil }: ITaskParameters) => {

    async function process(workspace: any, taskUtil: any) {
        const baseAppFiles = updateCache(options.configuration);
        const appVariantResources = await AppVariantManager.getAppVariantResources(workspace);
        const appVariantInfo = AppVariantManager.process(appVariantResources, options.projectNamespace, taskUtil);
        const baseAppResources = await BaseAppManager.process(await baseAppFiles, await appVariantInfo, options);
        await Promise.all(appVariantResources.concat(baseAppResources).map(resource => workspace.write(resource)));
    }

    return process(workspace, taskUtil);

}