export default class BuildStrategy {

    handleError(error: any) {
        throw error;
    }


    processTexts(manifest: any) {
        if (typeof manifest["sap.app"].i18n === "string") {
            manifest["sap.app"].i18n = { bundleUrl: manifest["sap.app"].i18n };
        }
        return manifest;
    }
}