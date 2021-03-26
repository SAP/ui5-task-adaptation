import { IChangeText } from "./model/types";

export default class BuildStrategy {

    private registrationBuild: any;
    private applyUtil: any;
    private i18nBundleName: string;


    constructor(registrationBuild: any, applyUtil: any, i18nBundleName: string) {
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


    processTexts(manifest: any, changeTexts: IChangeText) {
        if (typeof manifest["sap.app"].i18n === "string") {
            manifest["sap.app"].i18n = { bundleUrl: manifest["sap.app"].i18n };
        }
        if (manifest["sap.app"].i18n.enhanceWith == null) {
            manifest["sap.app"].i18n.enhanceWith = [];
        }
        const bundleName = this.applyUtil.formatBundleName(manifest["sap.app"].id + "." + this.i18nBundleName, changeTexts.i18n);
        const doubles = manifest["sap.app"].i18n.enhanceWith.some((entry: any) => entry.bundleName === bundleName);
        if (!doubles) {
            manifest["sap.app"].i18n.enhanceWith.push({ bundleName: bundleName });
        }
        return manifest;
    }
}