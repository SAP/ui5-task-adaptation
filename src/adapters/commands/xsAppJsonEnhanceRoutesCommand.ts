import { enhanceRoutesWithEndpointAndService } from "../../util/cf/xsAppJsonUtil.js";
import { IConfiguration, ServiceCredentials } from "../../model/types.js";
import CFUtil from "../../util/cfUtil.js";
import { getLogger } from "@ui5/logger";
import { PostCommand } from "./command.js";
const log = getLogger("@ui5/task-adaptation::CFProcessor");


export default class XsAppJsonEnhanceRoutesCommand extends PostCommand {
    constructor(private configuration: IConfiguration) {
        super();
    }

    async execute(files: Map<string, string>): Promise<void> {
        const { serviceInstanceName, space } = this.configuration;
        if (!serviceInstanceName) {
            throw new Error(`Service instance name must be specified in ui5.yaml configuration for app '${this.configuration.appName}'`);
        }

        let serviceCredentials: ServiceCredentials | undefined;
        try {
            // Get valid service keys with proper endpoints structure
            serviceCredentials = await CFUtil.getOrCreateServiceKeyWithEndpoints(serviceInstanceName, space);
        } catch (error: any) {
            throw new Error(`Failed to get valid service keys for app '${this.configuration.appName}': ${error.message}`);
        }

        if (serviceCredentials) {
            const xsAppJson = files.get("xs-app.json");
            if (xsAppJson) {
                files.set("xs-app.json", enhanceRoutesWithEndpointAndService(xsAppJson, serviceCredentials));
            }
        } else {
            log.info(`No endpoints found for app '${this.configuration.appName}'. xs-app.json will not be updated.`);
        }
    }
}
