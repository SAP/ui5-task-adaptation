import { IConfiguration } from "../model/configuration.js";
import { IAdapter } from "./adapter.js";
import { AdaptCommandChain, ManifestUpdateCommandChain, MergeCommandChain, PostCommandChain } from "./commands/command.js";
import { IAppVariantIdHierarchyManifestItem } from "../model/appVariantIdHierarchyItem.js";
import BaseApp from "../baseAppManager.js";
import AppVariant from "../appVariantManager.js";
import AddAppVariantIdHierarchyCommand from "./commands/addAppVariantIdHierarchyCommand.js";
import ApplyDescriptorChangesCommand from "./commands/applyDescriptorChangesCommand.js";
import SetAppVariantIdCommand from "./commands/setAppVariantIdCommand.js";
import UpdateComponentNameCommand from "./commands/updateComponentNameCommand.js";
import AnnotationManager from "../annotationManager.js";
import DownloadAnnotationsCommand from "./commands/downloadAnnotationsCommand.js";
import I18nPropertiesMergeCommand from "./commands/i18nPropertiesMergeCommand.js";
import UpdateCloudDevAdaptationCommand from "./commands/updateCloudDevAdaptationCommand.js";


export default class AbapAdapter implements IAdapter {
    constructor(private configuration: IConfiguration, private annotationManager: AnnotationManager) { }

    createAdaptCommandChain(baseApp: BaseApp, appVariant: AppVariant): AdaptCommandChain {
        const manifestChanges = appVariant.getProcessedManifestChanges();
        const appVariantIdHierarchyItem = {
            appVariantId: baseApp.id,
            version: baseApp.version,
            layer: "VENDOR"
        } as IAppVariantIdHierarchyManifestItem;
        return new AdaptCommandChain(baseApp.files, [
            new ManifestUpdateCommandChain([
                new SetAppVariantIdCommand(appVariant.id),
                new UpdateComponentNameCommand(baseApp.id),
                new ApplyDescriptorChangesCommand(manifestChanges, appVariant.prefix),
                new AddAppVariantIdHierarchyCommand(appVariantIdHierarchyItem),
                new UpdateCloudDevAdaptationCommand(),
            ]),
            new DownloadAnnotationsCommand(appVariant.id, appVariant.prefix, this.annotationManager, this.configuration),
        ]);
    }

    createMergeCommandChain(baseApp: BaseApp, appVariant: AppVariant): MergeCommandChain {
        const manifestChanges = appVariant.getProcessedManifestChanges();
        return new MergeCommandChain([
            new I18nPropertiesMergeCommand(baseApp.i18nPath, appVariant.prefix, manifestChanges),
        ]);
    }

    createPostCommandChain(): PostCommandChain {
        // No post commands needed for ABAP, return an empty chain
        return new PostCommandChain([]);
    }
}
