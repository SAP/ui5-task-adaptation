import { IConfiguration } from "../../model/configuration.js";
import { ServiceCredentials } from "../../model/types.js";
import CFUtil from "../../util/cfUtil.js";
import { validateObject } from "../../util/commonUtil.js";
import { IPromiseCommand, SetupCommand } from "./command.js";

export default class FetchEndpointsCommand extends SetupCommand implements IPromiseCommand<ServiceCredentials | undefined> {
    result: Promise<ServiceCredentials | undefined> = Promise.resolve(undefined);

    constructor(private configuration: IConfiguration) {
        super();
    }

    async execute(): Promise<void> {
        validateObject(this.configuration, ["serviceInstanceName"], "should be specified in ui5.yaml configuration");
        const { serviceInstanceName, space } = this.configuration;
        // Get valid service keys with proper endpoints structure
        this.result = CFUtil.getOrCreateServiceKeyWithEndpoints(serviceInstanceName!, space).catch(error => {
            const errorText = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to get a service key with endpoints for service instance '${serviceInstanceName}' in space '${space}': ${errorText}`);
        });
    }
}
