import AppVariant from "../appVariantManager.js";
import BaseApp from "../baseAppManager.js";
import { IConfiguration } from "../model/configuration.js";
import { IAdapter } from "./adapter.js";
import CFAdapter from "./cfAdapter.js";
import { AdaptCommandChain, MergeCommandChain, PostCommandChain } from "./commands/command.js";


export default class PreviewAdapter implements IAdapter {
    private cfAdapter: CFAdapter;

    constructor(configuration: IConfiguration) {
        this.cfAdapter = new CFAdapter(configuration);
    }

    createAdaptCommandChain(baseApp: BaseApp, appVariant: AppVariant): AdaptCommandChain {
        return this.cfAdapter.createAdaptCommandChain(baseApp, appVariant);
    }

    createMergeCommandChain(baseApp: BaseApp, appVariant: AppVariant): MergeCommandChain {
        return this.cfAdapter.createMergeCommandChain(baseApp, appVariant);
    }

    createPostCommandChain(): PostCommandChain {
        return this.cfAdapter.createPostCommandChain();
    }
}
