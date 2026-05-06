import AppVariant from "../appVariant.js";
import BaseApp from "../baseApp.js";
import { IAppVariantIdHierarchyManifestItem } from "../model/appVariantIdHierarchyItem.js";
import { UI5BuilderTools } from "../model/types.js";
import IRepository from "../repositories/repository.js";
import AddAppVariantIdHierarchyCommand from "./commands/addAppVariantIdHierarchyCommand.js";
import ApplyDescriptorChangesCommand from "./commands/applyDescriptorChangesCommand.js";
import { AdaptCommandChain, IPromiseCommand, ManifestUpdateCommand, MergeCommandChain, PostCommand, PostCommandChain, SetupCommandChain } from "./commands/command.js";
import FilterFilesCommand from "./commands/filterFilesCommand.js";
import OmitDeletedResourcesCommand from "./commands/omitDeletedResourcesCommand.js";
import RenameFilesCommand from "./commands/renameFilesCommand.js";
import SetAppVariantIdCommand from "./commands/setAppVariantIdCommand.js";
import UpdateCloudDevAdaptationCommand from "./commands/updateCloudDevAdaptationCommand.js";
import UpdateComponentNameCommand from "./commands/updateComponentNameCommand.js";
import WriteResourcesCommand from "./commands/writeResourcesCommand.js";

export interface IAdapter {
    createSetupCommandChain(appId: string, repository: IRepository): SetupCommandChain;
    createAdaptCommandChain(baseApp: BaseApp, appVariant: AppVariant): AdaptCommandChain;
    createMergeCommandChain(baseApp: BaseApp, appVariant: AppVariant): MergeCommandChain;
    createPostCommandChain(
        references: Map<string, string>,
        adaptationProject: AppVariant,
        ui5BuilderTools: UI5BuilderTools,
    ): PostCommandChain;
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

export function getCommonPostCommands(
    references: Map<string, string>,
    adaptationProject: AppVariant,
    ui5BuilderTools: UI5BuilderTools,
): PostCommand[] {
    const { movedFiles, resources } = adaptationProject;
    const { workspace, taskUtil, projectNamespace } = ui5BuilderTools;
    return [
        new FilterFilesCommand(),
        new RenameFilesCommand(references),
        new OmitDeletedResourcesCommand(taskUtil, movedFiles, resources, projectNamespace),
        new WriteResourcesCommand(workspace, projectNamespace),
    ];
}

export function dependsOn<T>(promise: IPromiseCommand<T> | null): Promise<T> {
    if (!promise) {
        throw new Error("Dependent command was not executed, promise is not available");
    }
    return promise.result;
}
