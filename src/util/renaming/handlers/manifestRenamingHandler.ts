import JsonRenamingHandler from "./jsonRenamingHandler.js";

export default class ManifestRenamingHandler extends JsonRenamingHandler {
    protected readonly filePath = "manifest.json";
    // path to the JSON properties, forward slash separated, e.g. "sap.ui5/appVariantIdHierarchy"
    protected readonly jsonPathsToRestore = [
        "sap.ui5/appVariantIdHierarchy"
    ];
}
