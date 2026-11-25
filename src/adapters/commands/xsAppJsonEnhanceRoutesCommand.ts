import { fetchCredentialsAndEnhanceRoutes } from "../../util/cf/xsAppJsonUtil.js";
import { ServiceCredentials } from "../../model/types.js";
import { PostCommand } from "./command.js";
import { stringToBuffer, bufferToString } from "../../util/commonUtil.js";

export default class XsAppJsonEnhanceRoutesCommand extends PostCommand {
    constructor(private serviceCredentialsPromise: Promise<ServiceCredentials | undefined>) {
        super();
    }

    async execute(files: Map<string, Buffer>): Promise<void> {
        const xsAppJson = files.get("xs-app.json");
        if (xsAppJson) {
            const enhanced = await fetchCredentialsAndEnhanceRoutes(bufferToString(xsAppJson), this.serviceCredentialsPromise);
            files.set("xs-app.json", stringToBuffer(enhanced));
        }
    }
}
