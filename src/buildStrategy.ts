
export default class BuildStrategy {

    private registrationBuild: any;

    constructor(registrationBuild: any) {
        this.registrationBuild = registrationBuild;
    }


    registry() {
        return Promise.resolve(this.registrationBuild);
    }


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