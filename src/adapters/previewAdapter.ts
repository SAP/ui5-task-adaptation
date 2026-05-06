import AppVariant from "../appVariantManager.js";
import BaseApp from "../baseAppManager.js";
import { IConfiguration } from "../model/configuration.js";
import { UI5BuilderTools } from "../model/types.js";
import IRepository from "../repositories/repository.js";
import { dependsOn, getCommonPostCommands, IAdapter } from "./adapter.js";
import CFAdapter from "./cfAdapter.js";
import { AdaptCommandChain, MergeCommandChain, PostCommandChain, SetupCommandChain } from "./commands/command.js";
import FetchEndpointsCommand from "./commands/fetchEndpointsCommand.js";
import FetchPreviewResourcesCommand from "./commands/fetchPreviewResourcesCommand.js";
import ProcessPreviewResourcesCommand from "./commands/processPreviewResourcesCommand.js";
import XsAppJsonEnhanceRoutesCommand from "./commands/xsAppJsonEnhanceRoutesCommand.js";


export default class PreviewAdapter implements IAdapter {
    private cfAdapter: CFAdapter;
    private fetchPreviewResourcesCommand: FetchPreviewResourcesCommand | null = null;
    private fetchEndpointsCommand: FetchEndpointsCommand | null = null;

    constructor(private configuration: IConfiguration, cfAdapter?: CFAdapter) {
        this.cfAdapter = cfAdapter ?? new CFAdapter(configuration);
    }

    createSetupCommandChain(appId: string, repository: IRepository): SetupCommandChain {
        this.fetchPreviewResourcesCommand = new FetchPreviewResourcesCommand(appId, repository);
        this.fetchEndpointsCommand = new FetchEndpointsCommand(this.configuration);
        return new SetupCommandChain([
            this.fetchPreviewResourcesCommand,
            this.fetchEndpointsCommand
        ]);
    }

    createAdaptCommandChain(baseApp: BaseApp, appVariant: AppVariant): AdaptCommandChain {
        return this.cfAdapter.createAdaptCommandChain(baseApp, appVariant);
    }

    createMergeCommandChain(baseApp: BaseApp, appVariant: AppVariant): MergeCommandChain {
        return this.cfAdapter.createMergeCommandChain(baseApp, appVariant);
    }

    createPostCommandChain(
        references: Map<string, string>,
        adaptationProject: AppVariant,
        ui5BuilderTools: UI5BuilderTools,
    ): PostCommandChain {
        const serviceCredentialsPromise = dependsOn(this.fetchEndpointsCommand);
        const previewPromise = dependsOn(this.fetchPreviewResourcesCommand);
        return new PostCommandChain([
            new ProcessPreviewResourcesCommand(serviceCredentialsPromise, previewPromise),
            new XsAppJsonEnhanceRoutesCommand(serviceCredentialsPromise),
            ...getCommonPostCommands(
                references,
                adaptationProject,
                ui5BuilderTools,
            )
        ]);
    }
}
