//@ts-check
class BuildStrategy {

    constructor(requireAsync, ApplyUtil, module) {
        this.requireAsync = requireAsync;
        this.ApplyUtil = ApplyUtil;
        this.module = module;
    }

    registry() {
        return this.requireAsync("sap/ui/fl/apply/_internal/changes/descriptor/RegistrationBuild");
    }

    handleError(error) {
        throw error;
    }

    processTexts(manifest, changeTexts) {
        if (typeof manifest["sap.app"].i18n === "string") {
            manifest["sap.app"].i18n = { bundleUrl: manifest["sap.app"].i18n };
        }
        if (!manifest["sap.app"].i18n.enhanceWith) {
            manifest["sap.app"].i18n.enhanceWith = [];
        }
        const bundleName = this.ApplyUtil.formatBundleName(
            manifest["sap.app"].id + "." + this.module, changeTexts.i18n);

        const doubles = manifest["sap.app"].i18n.enhanceWith.some(entry => entry.bundleName === bundleName);
        if (!doubles) {
            manifest["sap.app"].i18n.enhanceWith.push({ bundleName: bundleName });
        }
        return manifest;
    }
}

module.exports = BuildStrategy;