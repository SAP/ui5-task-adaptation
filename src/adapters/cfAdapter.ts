import { IConfiguration } from "../model/configuration.js";
import { dependsOn, getCommonManifestUpdateCommands, getCommonPostCommands, IAdapter } from "./adapter.js";
import { AdaptCommandChain, ManifestUpdateCommandChain, MergeCommandChain, PostCommandChain, SetupCommandChain } from "./commands/command.js";
import { IAppVariantIdHierarchyManifestItem } from "../model/appVariantIdHierarchyItem.js";
import XsAppJsonEnhanceRoutesCommand from "./commands/xsAppJsonEnhanceRoutesCommand.js";
import BaseApp from "../baseApp.js";
import AppVariant from "../appVariant.js";
import UpdateCloudPlatformCommand from "./commands/updateCloudPlatformCommand.js";
import I18nPropertiesMergeCommand from "./commands/i18nPropertiesMergeCommand.js";
import XsAppJsonMergeCommand from "./commands/xsAppJsonMergeCommand.js";
import { UI5BuilderTools } from "../model/types.js";
import FetchEndpointsCommand from "./commands/fetchEndpointsCommand.js";
import IRepository from "../repositories/repository.js";


export default class CFAdapter implements IAdapter {
    private fetchEndpointsCommand: FetchEndpointsCommand | null = null;

    constructor(private configuration: IConfiguration) { }

    createSetupCommandChain(_appId: string, _repository: IRepository): SetupCommandChain {
        this.fetchEndpointsCommand = new FetchEndpointsCommand(this.configuration);
        return new SetupCommandChain([
            this.fetchEndpointsCommand
        ]);
    }

    createAdaptCommandChain(baseApp: BaseApp, appVariant: AppVariant): AdaptCommandChain {
        const appVariantIdHierarchyItem = {
            appVariantId: baseApp.id,
            version: baseApp.version
        } as IAppVariantIdHierarchyManifestItem;
        return new AdaptCommandChain(baseApp.files, [
            new ManifestUpdateCommandChain([
                ...getCommonManifestUpdateCommands(baseApp, appVariant, appVariantIdHierarchyItem),
                new UpdateCloudPlatformCommand(this.configuration.sapCloudService),
            ]),
        ]);
    }

    createMergeCommandChain(baseApp: BaseApp, appVariant: AppVariant): MergeCommandChain {
        const manifestChanges = appVariant.getProcessedManifestChanges();
        return new MergeCommandChain(appVariant.getProcessedFiles(), [
            new I18nPropertiesMergeCommand(baseApp.i18nPath, appVariant.prefix, manifestChanges),
            new XsAppJsonMergeCommand(),
        ]);
    }

    createPostCommandChain(
        references: Map<string, string>,
        adaptationProject: AppVariant,
        ui5BuilderTools: UI5BuilderTools,
    ): PostCommandChain {
        const serviceCredentialsPromise = dependsOn(this.fetchEndpointsCommand);
        return new PostCommandChain([
            new XsAppJsonEnhanceRoutesCommand(serviceCredentialsPromise),
            ...getCommonPostCommands(
                references,
                adaptationProject,
                ui5BuilderTools,
            )
        ]);
    }
}
