import BaseApp from "../baseAppManager.js";
import AppVariant from "../appVariantManager.js";
import { IAdapter } from "./adapter.js";
import { MergeCommandChain } from "./commands/command.js";
import I18nPropertiesMergeCommand from "./commands/i18nPropertiesMergeCommand.js";
import XsAppJsonMergeCommand from "./commands/xsAppJsonMergeCommand.js";


export default class CFAdapter implements IAdapter {
    createMergeCommandChain(baseApp: BaseApp, appVariant: AppVariant): MergeCommandChain {
        const manifestChanges = appVariant.getProcessedManifestChanges();
        return new MergeCommandChain([
            new I18nPropertiesMergeCommand(baseApp.i18nPath, appVariant.prefix, manifestChanges),
            new XsAppJsonMergeCommand(),
        ]);
    }
}
