import AppVariant from "../appVariantManager.js";
import BaseApp from "../baseAppManager.js";
import { AdaptCommandChain, MergeCommandChain, PostCommandChain } from "./commands/command.js";

export interface IAdapter {
    createAdaptCommandChain(baseApp: BaseApp, appVariant: AppVariant): AdaptCommandChain;
    createMergeCommandChain(baseApp: BaseApp, appVariant: AppVariant): MergeCommandChain;
    createPostCommandChain(): PostCommandChain;
}
