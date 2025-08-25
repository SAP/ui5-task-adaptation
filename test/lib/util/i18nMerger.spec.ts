import AppVariant from "../../../src/appVariantManager.js";
import BaseApp from "../../../src/baseAppManager.js";
import FileMerger from "../../../src/util/i18nMerger.js";
import TestUtil from "../testUtilities/testUtil.js";
import { expect } from "chai";

describe("FileMerger", () => {

    describe("should merge and copy ", () => {
        it("should copy and merge correctly", async () => {
            const manifest = JSON.parse(TestUtil.getResource("manifest.json"));
            manifest["sap.app"].i18n = "i18n/baseAppI18n";
            const baseAppFiles = new Map([
                ["manifest.json", JSON.stringify(manifest)],
                ["i18n/baseAppI18n.properties", "base=a\nmerge=a"],
                ["i18n/baseAppI18n_de.properties", TestUtil.getResource("i18n_de-expected.properties")],
                ["i18n/baseAppI18n_de_AU.properties", TestUtil.getResource("i18n_de-expected.properties")],
                ["i18n/baseAppI18n_zh_TW_Traditional.properties", "base=zh_TW_Traditional"],

                ["changes/coding/id_12345.js", "some js"],
                ["changes/id_1696839317667_propertyChange.change", "a flex change"],
                ["changes/fragments/AdlChart.fragment.xml", "A fragment"],
            ]);
            const appVariantManifest = JSON.parse(TestUtil.getResource("appVariant1/webapp/manifest.appdescr_variant"));
            appVariantManifest.content = [
                {
                    changeType: "appdescr_app_setTitle",
                    texts: { i18n: "i18n/toMerge.properties" }
                }, {
                    changeType: "appdescr_ui5_addNewModelEnhanceWith",
                    texts: { i18n: "i18n/toCopy.properties" }
                }, {
                    changeType: "appdescr_ui5_addNewModelEnhanceWith",
                    content: { bundleUrl: "i18n/toMerge/Copy.properties" }
                }, {
                    changeType: "appdescr_ui5_otherChange",
                    content: { modelId: "whatEver" }
                }, {
                    changeType: "appdescr_app_setTitle",
                    texts: { i18n: "i18n/toMerge/Copy.properties" }
                }];
            const appVariantFiles = new Map([
                ["manifest.appdescr_variant", JSON.stringify(appVariantManifest)],
                ["i18n/toMerge.properties", "merge=b"],
                ["i18n/toMerge_de.properties", TestUtil.getResource("i18n_de-expected.properties")],
                ["i18n/toMerge_de_AU.properties", TestUtil.getResource("i18n_de-expected.properties")],
                ["i18n/toMerge_zh_TW_Traditional.properties", "merge=zh_TW_Traditional"],
                ["i18n/toMerge_xy.properties", TestUtil.getResource("i18n_de-expected.properties")],
                ["i18n/toCopy.properties", TestUtil.getResource("i18n.properties")],
                ["i18n/toCopy_de.properties", TestUtil.getResource("i18n_de-expected.properties")],
                ["i18n/toCopy_de_AU.properties", TestUtil.getResource("i18n_de-expected.properties")],
                ["i18n/toCopy_zh_TW_Traditional.properties", TestUtil.getResource("i18n_de-expected.properties")],
                ["i18n/toMerge/Copy.properties", "merge2=c"],
                ["i18n/toMerge/Copy_de.properties", TestUtil.getResource("i18n_de-expected.properties")],
                ["i18n/toMerge/Copy_yz.properties", TestUtil.getResource("i18n.properties")],
                ["i18n/baseAppI18n.properties", "Ignore me=and don't omit the base app one"],
                ["i18n/baseAppI18n_de.properties", "Ignore me=and don't omit the base app one"]
            ]);

            const baseApp = await BaseApp.fromFiles(baseAppFiles);
            const appVariant = await AppVariant.fromFiles(appVariantFiles);
            const files = await FileMerger.merge(baseApp.files, baseApp.i18nPath, appVariant);

            const expectedResources = [
                "manifest.json",
                "manifest.appdescr_variant", // we will filter it out later
                "i18n/baseAppI18n.properties",
                "i18n/baseAppI18n_de.properties",
                "i18n/baseAppI18n_de_AU.properties",
                "i18n/baseAppI18n_zh_TW_Traditional.properties",
                "i18n/baseAppI18n_xy.properties",
                "i18n/baseAppI18n_yz.properties",
                "customer_com_sap_application_variant_id/i18n/toCopy.properties",
                "customer_com_sap_application_variant_id/i18n/toCopy_de.properties",
                "customer_com_sap_application_variant_id/i18n/toCopy_de_AU.properties",
                "customer_com_sap_application_variant_id/i18n/toCopy_zh_TW_Traditional.properties",
                "customer_com_sap_application_variant_id/i18n/toMerge/Copy.properties",
                "customer_com_sap_application_variant_id/i18n/toMerge/Copy_de.properties",
                "customer_com_sap_application_variant_id/i18n/toMerge/Copy_yz.properties",

                "changes/coding/id_12345.js",
                "changes/id_1696839317667_propertyChange.change",
                "changes/fragments/AdlChart.fragment.xml"
            ];
            expectedResources.sort();
            const actual = [...files.keys()];
            actual.sort();
            expect(actual).to.have.members(expectedResources);
            expect(files.get("i18n/baseAppI18n.properties")!.split("\n")).to.include.members([
                "base=a",
                "merge=b",
                "merge2=c",
            ]).but.to.not.include(
                "Ignore me=and don't omit the base app one"
                //).but.to.not.include(
                // FIXME Currently merge could duplicate keys which causes undefined behavior
                //"merge=a"
            );
            expect(files.get("i18n/baseAppI18n_zh_TW_Traditional.properties")!.split("\n")).to.include.members([
                "base=zh_TW_Traditional",
                "merge=zh_TW_Traditional"
            ]);
        });
    });
});
