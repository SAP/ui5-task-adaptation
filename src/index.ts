import TaskUtil from "@ui5/builder/lib/tasks/TaskUtil";
import { DuplexCollection } from "@ui5/fs/lib";
import { BaseAppManager } from "./baseAppManager";
import { ITaskParameters } from "./model/types";
import AppVariantManager from "./appVariantManager";
import HTML5RepoManager from "./html5RepoManager";

/**
 * Creates an appVariant bundle from the provided resources.
 */
module.exports = ({ workspace, options, taskUtil }: ITaskParameters) => {

    async function process(workspace: DuplexCollection, taskUtil: TaskUtil) {
        const baseAppFiles = HTML5RepoManager.getBaseAppFiles(options);
        const appVariantResources = await AppVariantManager.getAppVariantResources(workspace);
        const appVariantInfo = AppVariantManager.process(appVariantResources, options.projectNamespace, taskUtil);
        const baseAppResources = await BaseAppManager.process(await baseAppFiles, await appVariantInfo, options);
        return appVariantResources.concat(baseAppResources);
    }

    return process(workspace, taskUtil);

}