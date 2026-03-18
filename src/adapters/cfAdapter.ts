import { IConfiguration } from "../model/configuration.js";
import { getCommonManifestUpdateCommands, IAdapter } from "./adapter.js";
import { AdaptCommandChain, ManifestUpdateCommandChain, MergeCommandChain, PostCommandChain } from "./commands/command.js";
import { IAppVariantIdHierarchyManifestItem } from "../model/appVariantIdHierarchyItem.js";
import XsAppJsonEnhanceRoutesCommand from "./commands/xsAppJsonEnhanceRoutesCommand.js";
import BaseApp from "../baseAppManager.js";
import AppVariant from "../appVariantManager.js";
import UpdateCloudPlatformCommand from "./commands/updateCloudPlatformCommand.js";
import I18nPropertiesMergeCommand from "./commands/i18nPropertiesMergeCommand.js";
import XsAppJsonMergeCommand from "./commands/xsAppJsonMergeCommand.js";


export default class CFAdapter implements IAdapter {
    constructor(private configuration: IConfiguration) { }

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

    createPostCommandChain(): PostCommandChain {
        return new PostCommandChain([
            new XsAppJsonEnhanceRoutesCommand(this.configuration),
        ]);
    }
}
