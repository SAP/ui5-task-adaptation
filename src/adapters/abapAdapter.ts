import { getCommonManifestUpdateCommands, IAdapter } from "./adapter.js";
import { AdaptCommandChain, ManifestUpdateCommandChain, MergeCommandChain, PostCommandChain } from "./commands/command.js";
import { IAppVariantIdHierarchyManifestItem } from "../model/appVariantIdHierarchyItem.js";
import BaseApp from "../baseAppManager.js";
import AppVariant from "../appVariantManager.js";
import AnnotationManager from "../annotations/annotationManager.js";
import DownloadAnnotationsCommand from "./commands/downloadAnnotationsCommand.js";
import I18nPropertiesMergeCommand from "./commands/i18nPropertiesMergeCommand.js";


export default class AbapAdapter implements IAdapter {
    constructor(private annotationManager: AnnotationManager) { }

    createAdaptCommandChain(baseApp: BaseApp, appVariant: AppVariant): AdaptCommandChain {
        const appVariantIdHierarchyItem = {
            appVariantId: baseApp.id,
            version: baseApp.version,
            layer: "VENDOR"
        } as IAppVariantIdHierarchyManifestItem;
        return new AdaptCommandChain(baseApp.files, [
            new ManifestUpdateCommandChain([
                ...getCommonManifestUpdateCommands(baseApp, appVariant, appVariantIdHierarchyItem),
            ]),
            new DownloadAnnotationsCommand(appVariant.id, appVariant.prefix, this.annotationManager),
        ]);
    }

    createMergeCommandChain(baseApp: BaseApp, appVariant: AppVariant): MergeCommandChain {
        const manifestChanges = appVariant.getProcessedManifestChanges();
        return new MergeCommandChain(appVariant.getProcessedFiles(), [
            new I18nPropertiesMergeCommand(baseApp.i18nPath, appVariant.prefix, manifestChanges),
        ]);
    }

    createPostCommandChain(): PostCommandChain {
        // No post commands needed for ABAP, return an empty chain
        return new PostCommandChain([]);
    }
}
