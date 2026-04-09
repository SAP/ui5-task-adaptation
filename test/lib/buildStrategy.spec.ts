import * as chai from "chai";

import BuildStrategy from "../../src/buildStrategy.js";

const { expect } = chai;

describe("BuildStrategy", () => {

    const EXPECTED_I18N = {
        "bundleUrl": "i18n/i18n.properties"
    };

    const BASE_APP = {
        "sap.app": {
            id: "com.sap.manifest.sample",
            i18n: "i18n/i18n.properties",
            applicationVersion: { version: "1.0.0" }
        }
    };

    it("should create enhanceWith", () => {
        const strategy = new BuildStrategy();
        strategy.processTexts(BASE_APP);
        expect(BASE_APP["sap.app"].i18n).to.eql(EXPECTED_I18N);
    });

    it("should not add double", () => {
        const strategy = new BuildStrategy();
        const baseAppManifest = { ...BASE_APP, i18n: EXPECTED_I18N };
        strategy.processTexts(baseAppManifest);
        expect(baseAppManifest["sap.app"].i18n).to.eql(EXPECTED_I18N);
    });

});