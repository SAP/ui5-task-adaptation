import { fetchCredentialsAndEnhanceRoutes } from "../../util/cf/xsAppJsonUtil.js";
import { IConfiguration } from "../../model/types.js";
import { PostCommand } from "./command.js";

export default class XsAppJsonEnhanceRoutesCommand extends PostCommand {
    constructor(private configuration: IConfiguration) {
        super();
    }

    async execute(files: Map<string, string>): Promise<void> {
        let xsAppJson = files.get("xs-app.json");
        if (xsAppJson) {
            xsAppJson = await fetchCredentialsAndEnhanceRoutes(xsAppJson, this.configuration);
            files.set("xs-app.json", xsAppJson);
        }
    }
}
