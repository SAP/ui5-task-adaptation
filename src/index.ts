import { IConfiguration, ITaskParameters } from "./model/types";

import AppVariantManager from "./appVariantManager";
import BaseAppManager from "./baseAppManager";
import HTML5RepoManager from "./html5RepoManager";
import ResourceUtil from "./util/resourceUtil";

/**
 * Creates an appVariant bundle from the provided resources.
 */
module.exports = ({ workspace, options, taskUtil }: ITaskParameters) => {

    async function process(workspace: any, taskUtil: any) {
        const baseAppFiles = getBaseAppFiles(options.configuration);
        const appVariantResources = await AppVariantManager.getAppVariantResources(workspace);
        const appVariantInfo = AppVariantManager.process(appVariantResources, options.projectNamespace, taskUtil);
        const baseAppResources = await BaseAppManager.process(await baseAppFiles, await appVariantInfo, options);
        await Promise.all(appVariantResources.concat(baseAppResources).map(resource => workspace.write(resource)));
    }


    async function getBaseAppFiles(configuration: IConfiguration) {
        let result = new Map<string, string>();
        if (!configuration.ignoreCache) {
            result = await ResourceUtil.readTemp(configuration);
        }
        if (result.size === 0) {
            const [metadata, baseAppFiles] = await Promise.all([
                HTML5RepoManager.getMetadata(configuration),
                HTML5RepoManager.getBaseAppFiles(configuration)
            ]);
            const metadataMap = new Map([[ResourceUtil.METADATA_FILENAME, JSON.stringify(metadata)]]);
            await ResourceUtil.writeTemp(configuration, new Map([...baseAppFiles, ...metadataMap]));
            return baseAppFiles;
        }
        return result;
    }


    return process(workspace, taskUtil);

}