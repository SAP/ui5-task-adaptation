import { set } from "../../util/objectPath.js";
import { ManifestUpdateCommand } from "./command.js";

export default class UpdateCloudDevAdaptationCommand extends ManifestUpdateCommand {
    async execute(manifest: any): Promise<void> {
        if (manifest["sap.fiori"]?.cloudDevAdaptationStatus) {
            delete manifest["sap.fiori"].cloudDevAdaptationStatus;
        }
        set(manifest, ["sap.ui5", "isCloudDevAdaptation"], true);
    }
}
