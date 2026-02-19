import HTML5RepoManager from "../repositories/html5RepoManager.js";
import { IAppVariantIdHierarchyItem } from "../model/appVariantIdHierarchyItem.js";
import { IConfiguration, IReuseLibInfo } from "../model/types.js";
import IProcessor from "./processor.js";
import { cached } from "../cache/cacheHolder.js";
import { validateObject } from "../util/commonUtil.js";
import CFAdapter from "../adapters/cfAdapter.js";
import { IAdapter } from "../adapters/adapter.js";

export default class CFProcessor implements IProcessor {

    protected configuration: IConfiguration;

    constructor(configuration: IConfiguration) {
        this.configuration = configuration;
    }


    getAdapter(): IAdapter {
        return new CFAdapter(this.configuration);
    }


    async getAppVariantIdHierarchy(appId: string): Promise<IAppVariantIdHierarchyItem[]> {
        const metadata = await HTML5RepoManager.getMetadata(this.configuration);
        return [{
            repoName: this.configuration.appName!,
            appVariantId: appId,
            cachebusterToken: metadata.changedOn
        }];
    }


    @cached()
    fetch(_repoName: string, _cachebusterToken: string): Promise<Map<string, string>> {
        return HTML5RepoManager.getBaseAppFiles(this.configuration);
    }

    @cached()
    fetchReuseLib(_libName: string, _cachebusterToken: string, lib: IReuseLibInfo): Promise<Map<string, string>> {
        return HTML5RepoManager.getReuseLibFiles(this.configuration, lib);
    }

    validateConfiguration(): void {
        validateObject(this.configuration, ["appHostId", "appName", "appVersion"], "should be specified in ui5.yaml configuration");
    }


    getConfigurationType(): string {
        return "cf";
    }
}
