import { ApplyUtil, RegistrationBuild } from "../dist/bundle";
import { IBaseAppManifest, IChangeText } from "./model/types";

export default class BuildStrategy {

    private registrationBuild: typeof RegistrationBuild;
    private applyUtil: typeof ApplyUtil;
    private i18nBundleName: string;

    constructor(registrationBuild: typeof RegistrationBuild, applyUtil: typeof ApplyUtil, i18nBundleName: string) {
        this.registrationBuild = registrationBuild;
        this.applyUtil = applyUtil;
        this.i18nBundleName = i18nBundleName;
    }

    registry() {
        return Promise.resolve(this.registrationBuild);
    }

    handleError(error: any) {
        throw error;
    }

    processTexts(manifest: IBaseAppManifest, changeTexts: IChangeText) {
        if (typeof manifest["sap.app"].i18n === "string") {
            manifest["sap.app"].i18n = { bundleUrl: manifest["sap.app"].i18n };
        }
        if (manifest["sap.app"].i18n.enhanceWith == null) {
            manifest["sap.app"].i18n.enhanceWith = [];
        }
        const bundleName = this.applyUtil.formatBundleName(manifest["sap.app"].id + "." + this.i18nBundleName, changeTexts.i18n);
        const doubles = manifest["sap.app"].i18n.enhanceWith.some(entry => entry.bundleName === bundleName);
        if (!doubles) {
            manifest["sap.app"].i18n.enhanceWith.push({ bundleName: bundleName });
        }
        return manifest;
    }
}