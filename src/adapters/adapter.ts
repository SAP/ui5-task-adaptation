import AppVariant from "../appVariantManager.js";
import BaseApp from "../baseAppManager.js";
import { MergeCommandChain } from "./commands/command.js";

export interface IAdapter {
    createMergeCommandChain(baseApp: BaseApp, appVariant: AppVariant): MergeCommandChain;
}
