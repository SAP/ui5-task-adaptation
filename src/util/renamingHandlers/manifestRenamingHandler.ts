import { IRenamingHandler } from "./renamingHandler.js";

export default class ManifestRenamingHandler implements IRenamingHandler {

    private appVariantIdHierarchy: any[] = [];

    before(files: ReadonlyMap<string, string>): void {
        const manifest = files.get("manifest.json");
        if (manifest) {
            const manifestJson = JSON.parse(manifest);
            this.appVariantIdHierarchy = manifestJson["sap.ui5"].appVariantIdHierarchy;
        }
    }

    after(files: Map<string, string>): void {
        const manifest = files.get("manifest.json");
        if (manifest) {
            const manifestJson = JSON.parse(manifest);
            manifestJson["sap.ui5"].appVariantIdHierarchy = this.appVariantIdHierarchy;
            files.set("manifest.json", JSON.stringify(manifestJson));
        }
    };

}
