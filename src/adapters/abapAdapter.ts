import { getCommonManifestUpdateCommands, getCommonPostCommands, IAdapter } from "./adapter.js";
import { AdaptCommandChain, ManifestUpdateCommandChain, MergeCommandChain, PostCommandChain, SetupCommandChain } from "./commands/command.js";
import { IAppVariantIdHierarchyManifestItem } from "../model/appVariantIdHierarchyItem.js";
import BaseApp from "../baseAppManager.js";
import AppVariant from "../appVariantManager.js";
import IAnnotationManager from "../annotations/annotationManager.js";
import DownloadAnnotationsCommand from "./commands/downloadAnnotationsCommand.js";
import I18nPropertiesMergeCommand from "./commands/i18nPropertiesMergeCommand.js";
import { UI5BuilderTools } from "../model/types.js";
import IRepository from "../repositories/repository.js";


export default class AbapAdapter implements IAdapter {
    constructor(private annotationManager: IAnnotationManager) { }

    createSetupCommandChain(_appId: string, _repository: IRepository): SetupCommandChain {
        return new SetupCommandChain([]);
    }

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

    createPostCommandChain(
        references: Map<string, string>,
        adaptationProject: AppVariant,
        ui5BuilderTools: UI5BuilderTools,
    ): PostCommandChain {
        return new PostCommandChain(
            getCommonPostCommands(
                references,
                adaptationProject,
                ui5BuilderTools,
            )
        );
    }
}
