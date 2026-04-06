import AppVariant from "../appVariantManager.js";
import BaseApp from "../baseAppManager.js";
import { IAppVariantIdHierarchyManifestItem } from "../model/appVariantIdHierarchyItem.js";
import AddAppVariantIdHierarchyCommand from "./commands/addAppVariantIdHierarchyCommand.js";
import ApplyDescriptorChangesCommand from "./commands/applyDescriptorChangesCommand.js";
import { AdaptCommandChain, ManifestUpdateCommand, MergeCommandChain, PostCommandChain } from "./commands/command.js";
import SetAppVariantIdCommand from "./commands/setAppVariantIdCommand.js";
import UpdateCloudDevAdaptationCommand from "./commands/updateCloudDevAdaptationCommand.js";
import UpdateComponentNameCommand from "./commands/updateComponentNameCommand.js";

export interface IAdapter {
    createAdaptCommandChain(baseApp: BaseApp, appVariant: AppVariant): AdaptCommandChain;
    createMergeCommandChain(baseApp: BaseApp, appVariant: AppVariant): MergeCommandChain;
    createPostCommandChain(): PostCommandChain;
}

export function getCommonManifestUpdateCommands(baseApp: BaseApp, appVariant: AppVariant, appVariantIdHierarchyItem: IAppVariantIdHierarchyManifestItem): ManifestUpdateCommand[] {
    const manifestChanges = appVariant.getProcessedManifestChanges();
    return [
        new SetAppVariantIdCommand(appVariant.id),
        new UpdateComponentNameCommand(baseApp.id),
        new ApplyDescriptorChangesCommand(manifestChanges, appVariant.prefix),
        new AddAppVariantIdHierarchyCommand(appVariantIdHierarchyItem),
        new UpdateCloudDevAdaptationCommand(),
    ];
}
