import I18NMerger from "../../src/util/i18nMerger";
import { IAppVariantInfo } from "../../src/model/types";
import ResourceUtil from "../../src/util/resourceUtil";
import TestUtil from "../testUtilities/testUtil";
import { expect } from "chai";

const { byIsOmited } = TestUtil;

const appVariantInfo: IAppVariantInfo = {
    id: "customer.com.sap.application.variant.id",
    reference: "",
    changes: []
};

describe("ResourceUtil", () => {


    describe("should merge and copy ", () => {
        it("should copy and merge correctly", async () => {
            const projectNamespace = "sampleProjectNamespace/v1";
            const rootPath = `/resources/${projectNamespace}/`;
            const i18nTextPathFromManifestJson = `i18n/baseAppI18n`;
            const projectMeta = await TestUtil.getWorkspace("appVariant1", projectNamespace);
            function makeResources(files: any) {
                return Object.entries(files).map(entry => ResourceUtil.createResource(entry[0],
                    projectNamespace, entry[1] as string));
            }
            const baseAppResourceFiles = makeResources({
                "i18n/baseAppI18n.properties": "base=a\nmerge=a",
                "i18n/baseAppI18n_de.properties": TestUtil.getResource("i18n_de-expected.properties"),
                "i18n/baseAppI18n_de_AU.properties": TestUtil.getResource("i18n_de-expected.properties"),
                "i18n/baseAppI18n_zh_TW_Traditional.properties": "base=zh_TW_Traditional",

                "changes/coding/id_12345.js": "some js",
                "changes/id_1696839317667_propertyChange.change": "a flex change",
                "changes/fragments/AdlChart.fragment.xml": "A fragment",
            });
            const appVariantResourceFiles = makeResources({
                "i18n/toMerge.properties": "merge=b",
                "i18n/toMerge_de.properties": TestUtil.getResource("i18n_de-expected.properties"),
                "i18n/toMerge_de_AU.properties": TestUtil.getResource("i18n_de-expected.properties"),
                "i18n/toMerge_zh_TW_Traditional.properties": "merge=zh_TW_Traditional",
                "i18n/toMerge_xy.properties": TestUtil.getResource("i18n_de-expected.properties"),
                "i18n/toCopy.properties": TestUtil.getResource("i18n.properties"),
                "i18n/toCopy_de.properties": TestUtil.getResource("i18n_de-expected.properties"),
                "i18n/toCopy_de_AU.properties": TestUtil.getResource("i18n_de-expected.properties"),
                "i18n/toCopy_zh_TW_Traditional.properties": TestUtil.getResource("i18n_de-expected.properties"),
                "i18n/toMerge/Copy.properties": "merge2=c",
                "i18n/toMerge/Copy_de.properties": TestUtil.getResource("i18n_de-expected.properties"),
                "i18n/toMerge/Copy_yz.properties": TestUtil.getResource("i18n.properties"),
                "i18n/baseAppI18n.properties": "Ignore me=and don't omit the base app one",
                "i18n/baseAppI18n_de.properties": "Ignore me=and don't omit the base app one"
            });
            appVariantInfo.changes = [
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

            const mergedFiles = (await I18NMerger.mergeI18NFiles(baseAppResourceFiles, appVariantResourceFiles, projectNamespace, i18nTextPathFromManifestJson, appVariantInfo, projectMeta.taskUtil))
                .filter(byIsOmited(projectMeta.taskUtil));

            const expectedResources = [
                `${rootPath}i18n/baseAppI18n.properties`,
                `${rootPath}i18n/baseAppI18n_de.properties`,
                `${rootPath}i18n/baseAppI18n_de_AU.properties`,
                `${rootPath}i18n/baseAppI18n_zh_TW_Traditional.properties`,
                `${rootPath}i18n/baseAppI18n_xy.properties`,
                `${rootPath}i18n/baseAppI18n_yz.properties`,
                `${rootPath}customer_com_sap_application_variant_id/i18n/toCopy.properties`,
                `${rootPath}customer_com_sap_application_variant_id/i18n/toCopy_de.properties`,
                `${rootPath}customer_com_sap_application_variant_id/i18n/toCopy_de_AU.properties`,
                `${rootPath}customer_com_sap_application_variant_id/i18n/toCopy_zh_TW_Traditional.properties`,
                `${rootPath}customer_com_sap_application_variant_id/i18n/toMerge/Copy.properties`,
                `${rootPath}customer_com_sap_application_variant_id/i18n/toMerge/Copy_de.properties`,
                `${rootPath}customer_com_sap_application_variant_id/i18n/toMerge/Copy_yz.properties`,

                `${rootPath}changes/coding/id_12345.js`,
                `${rootPath}changes/id_1696839317667_propertyChange.change`,
                `${rootPath}changes/fragments/AdlChart.fragment.xml`
            ];
            expect(mergedFiles.map(resource => resource.getPath())).to.have.members(expectedResources);
            expect((await TestUtil.getResourceByName(mergedFiles, `${rootPath}i18n/baseAppI18n.properties`)).split("\n")).to.include.members([
                "base=a",
                "merge=b",
                "merge2=c",
            ]).but.to.not.include(
                "Ignore me=and don't omit the base app one"
                //).but.to.not.include(
                // FIXME Currently merge could duplicate keys which causes undefined behavior
                //"merge=a"
            );
            expect((await TestUtil.getResourceByName(mergedFiles, `${rootPath}i18n/baseAppI18n_zh_TW_Traditional.properties`)).split("\n")).to.include.members([
                "base=zh_TW_Traditional",
                "merge=zh_TW_Traditional"
            ]);
        });
    });
});