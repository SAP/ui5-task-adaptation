import { ManifestUpdateCommand } from "./command.js";
import { set } from "../../util/objectPath.js";

export default class UpdateComponentNameCommand extends ManifestUpdateCommand {
    constructor(private baseAppId: string) {
        super();
    }

    async execute(manifest: any): Promise<void> {
        set(manifest, ["sap.ui5", "componentName"], this.baseAppId);
    }
}
