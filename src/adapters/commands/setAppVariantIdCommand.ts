import { set } from "../../util/objectPath.js";
import { ManifestUpdateCommand } from "./command.js";

const MANIFEST_FILE = "manifest.json";

export default class SetAppVariantIdCommand extends ManifestUpdateCommand {
    constructor(private appVariantId: string) {
        super();
    }

    accept = (filename: string) => filename === MANIFEST_FILE;

    async execute(manifest: any): Promise<void> {
        set(manifest, ["sap.app", "id"], this.appVariantId);
    }
}
