import { set } from "../../util/objectPath.js";
import { ManifestUpdateCommand } from "./command.js";

export default class UpdateCloudPlatformCommand extends ManifestUpdateCommand {
    constructor(private sapCloudService: string | undefined) {
        super();
    }

    async execute(manifest: any): Promise<void> {
        const sapCloudService = manifest["sap.cloud"]?.service;
        const sapPlatformCf = manifest["sap.platform.cf"];
        if (sapPlatformCf?.oAuthScopes && sapCloudService) {
            sapPlatformCf.oAuthScopes = sapPlatformCf.oAuthScopes.map((scope: string) =>
                scope.replace(`$XSAPPNAME.`, `$XSAPPNAME('${sapCloudService}').`));
        }
        if (this.sapCloudService) {
            set(manifest, ["sap.cloud", "service"], this.sapCloudService);
        } else {
            delete manifest["sap.cloud"];
        }
    }
}
