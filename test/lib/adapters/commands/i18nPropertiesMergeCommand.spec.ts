import esmock from "esmock";
import sinon, { SinonSandbox } from "sinon";
import { MergeCommandChain } from "../../../../src/adapters/commands/command.js";
import I18nPropertiesMergeCommand from "../../../../src/adapters/commands/i18nPropertiesMergeCommand.js";
import AppVariant from "../../../../src/appVariantManager.js";
import BaseApp from "../../../../src/baseAppManager.js";
import CacheHolder from "../../../../src/cache/cacheHolder.js";
import { IProjectOptions } from "../../../../src/model/types.js";
import TestUtil from "../../testUtilities/testUtil.js";
import { expect } from "chai";


describe("I18nPropertiesMergeCommand", () => {

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
            const mergeCommandChain = new MergeCommandChain([
                new I18nPropertiesMergeCommand(baseApp.i18nPath, appVariant.prefix, appVariant.getProcessedManifestChanges())
            ]);
            const files = await mergeCommandChain.execute(baseApp.files, appVariant.getProcessedFiles());

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


    describe("should merge and copy unit tests", () => {
        const OPTIONS: IProjectOptions = {
            projectNamespace: "ns",
            configuration: {
                type: "cf",
                appName: "repoName1",
                serviceInstanceName: "serviceInstanceName"
            }
        };
        let sandbox: SinonSandbox;

        before(() => CacheHolder.clear());
        beforeEach(() => sandbox = sinon.createSandbox());
        afterEach(() => sandbox.restore());

        it("should copy in target manifest/i18n with same path if not exist", async () => {
            const baseAppFiles = new Map([
                ["manifest.json", JSON.stringify({
                    "sap.app": {
                        "id": "com.sap.base.app.id",
                        "i18n": "i18n/i18n.properties",
                        "applicationVersion": {
                            "version": "1.0.0"
                        }
                    }
                })]]);
            const files = await test({
                baseAppFiles,
                appVariantFolder: "integration/appVar1",
                expectLength: 3,
                expectIncluded: [
                    "/resources/ns/i18n/i18n.properties",
                    "/resources/ns/i18n/i18n_de.properties",
                    "/resources/ns/manifest.json"
                ]
            });
            expect(await TestUtil.getResourceByName(files, "i18n/i18n.properties")).to.eql("appVariant");
            expect(await TestUtil.getResourceByName(files, "i18n/i18n_de.properties")).to.eql("appVariant de");
        });

        it("should create default i18n.properties, if manifest has no i18n", async () => {
            const baseAppFiles = new Map([
                ["manifest.json", JSON.stringify({
                    "sap.app": {
                        "id": "com.sap.base.app.id",
                        "applicationVersion": {
                            "version": "1.0.0"
                        }
                    }
                })]]);
            const files = await test({
                baseAppFiles,
                appVariantFolder: "integration/appVar8",
                expectLength: 2,
                expectIncluded: [
                    "/resources/ns/i18n/i18n.properties",
                    "/resources/ns/manifest.json"
                ]
            });
            // If manifest.json has no i18n property, appVariant i18n should be
            // copied to i18n/i18n.properties, it's default when property is absent.
            const manifest = JSON.parse(await TestUtil.getResourceByName(files, "manifest.json"));
            expect(manifest["sap.app"].title).to.eql("{{customer.com.sap.application.variant.id_sap.app.title}}");
            expect(manifest["sap.app"].i18n).to.be.undefined;
            expect(await TestUtil.getResourceByName(files, "/resources/ns/i18n/i18n.properties")).to.eql("appVariant");
        });

        it("should merge with target manifest/i18n with same path if exist", async () => {
            const baseAppFiles = new Map([
                ["i18n/i18n.properties", "original"],
                ["i18n/i18n_de.properties", "original de"],
                ["manifest.json", JSON.stringify({
                    "sap.app": {
                        "id": "com.sap.base.app.id",
                        "i18n": "i18n/i18n.properties",
                        "applicationVersion": {
                            "version": "1.0.0"
                        }
                    }
                })]]);
            const files = await test({
                baseAppFiles,
                appVariantFolder: "integration/appVar1", // AppVariant with simple change
                expectLength: 3,
                expectIncluded: [
                    "/resources/ns/i18n/i18n.properties",
                    "/resources/ns/i18n/i18n_de.properties",
                    "/resources/ns/manifest.json"
                ]
            });
            expect(await TestUtil.getResourceByName(files, "i18n/i18n.properties")).to.eql("original\n\n#App variant specific text file\n\nappVariant");
            expect(await TestUtil.getResourceByName(files, "i18n/i18n_de.properties")).to.eql("original de\n\n#App variant specific text file\n\nappVariant de");
        });

        it("should merge with target manifest/i18n with different path", async () => {
            const baseAppFiles = new Map([
                ["i18n/hugo.properties", "original"],
                ["i18n/hugo_de.properties", "original de"],
                ["manifest.json", JSON.stringify({
                    "sap.app": {
                        "id": "com.sap.base.app.id",
                        "i18n": "i18n/hugo.properties",
                        "applicationVersion": {
                            "version": "1.0.0"
                        }
                    }
                })]]);
            const files = await test({
                baseAppFiles,
                appVariantFolder: "integration/appVar1", // AppVariant with simple change
                expectLength: 3,
                expectIncluded: [
                    "/resources/ns/i18n/hugo.properties",
                    "/resources/ns/i18n/hugo_de.properties",
                    "/resources/ns/manifest.json"
                ]
            });
            expect(await TestUtil.getResourceByName(files, "i18n/hugo.properties")).to.eql("original\n\n#App variant specific text file\n\nappVariant");
            expect(await TestUtil.getResourceByName(files, "i18n/hugo_de.properties")).to.eql("original de\n\n#App variant specific text file\n\nappVariant de");
        });

        it("should merge custom folder with target manifest/i18n with different path", async () => {
            const baseAppFiles = new Map([
                ["i18n/hugo.properties", "original"],
                ["i18n/hugo_de.properties", "original de"],
                ["manifest.json", JSON.stringify({
                    "sap.app": {
                        "id": "com.sap.base.app.id",
                        "i18n": "i18n/hugo.properties",
                        "applicationVersion": {
                            "version": "1.0.0"
                        }
                    }
                })]]);
            const files = await test({
                baseAppFiles,
                appVariantFolder: "integration/appVar2", // AppVariant with simple change with custom folder
                expectLength: 3,
                expectIncluded: [
                    "/resources/ns/i18n/hugo.properties",
                    "/resources/ns/i18n/hugo_de.properties",
                    "/resources/ns/manifest.json"
                ]
            });
            expect(await TestUtil.getResourceByName(files, "i18n/hugo.properties")).to.eql("original\n\n#App variant specific text file\n\nappVariant");
            expect(await TestUtil.getResourceByName(files, "i18n/hugo_de.properties")).to.eql("original de\n\n#App variant specific text file\n\nappVariant de");
        });

        it("should copy enhanceWith properties and update changes", async () => {
            const baseAppFiles = new Map([
                ["manifest.json", JSON.stringify({
                    "sap.app": {
                        "id": "com.sap.base.app.id",
                        "i18n": "i18n/i18n.properties",
                        "applicationVersion": {
                            "version": "1.0.0"
                        }
                    },
                    "sap.ui5": {
                        models: {
                            "i18n|sap.suite.ui.generic.template.ListObject": {
                                "type": "sap.ui.model.resource.ResourceModel",
                                "settings": {
                                    "bundleName": "com.sap.base.app.id.i18n.i18n"
                                }
                            }
                        }
                    }
                })]]);
            const files = await test({
                baseAppFiles,
                appVariantFolder: "integration/appVar3", // AppVariant with enhanceWith change
                expectLength: 3,
                expectIncluded: [
                    "/resources/ns/customer_com_sap_application_variant_id/i18n/ListObject/i18n.properties",
                    "/resources/ns/customer_com_sap_application_variant_id/i18n/ListObject/i18n_de.properties",
                    "/resources/ns/manifest.json"
                ]
            });
            expect(await TestUtil.getResourceByName(files, "customer_com_sap_application_variant_id/i18n/ListObject/i18n.properties")).to.eql("appVariant");
            expect(await TestUtil.getResourceByName(files, "customer_com_sap_application_variant_id/i18n/ListObject/i18n_de.properties")).to.eql("appVariant de");
            const manifestJson = await TestUtil.getResourceByName(files, "manifest.json");
            expect(JSON.parse(manifestJson)).to.eql({
                "sap.app": {
                    "applicationVersion": {
                        "version": "1.0.0"
                    },
                    "i18n": "i18n/i18n.properties",
                    "id": "customer.com.sap.application.variant.id"
                },
                "sap.ui5": {
                    "appVariantIdHierarchy": [
                        {
                            "appVariantId": "com.sap.base.app.id",
                            "version": "1.0.0"
                        }
                    ],
                    "componentName": "customer.com.sap.application.variant.id",
                    "isCloudDevAdaptation": true,
                    "models": {
                        "i18n|sap.suite.ui.generic.template.ListObject": {
                            "type": "sap.ui.model.resource.ResourceModel",
                            "settings": {
                                "bundleName": "customer.com.sap.application.variant.id.i18n.i18n",
                                "enhanceWith": [{
                                    "bundleName": "customer.com.sap.application.variant.id.customer_com_sap_application_variant_id.i18n.ListObject.i18n"
                                }]
                            }
                        }
                    }
                }
            });
        });

        it("should copy enhanceWith and merge simple change with same i18n paths", async () => {
            const baseAppFiles = new Map([
                ["i18n/i18n.properties", "original"],
                ["i18n/i18n_de.properties", "original de"],
                ["manifest.json", JSON.stringify({
                    "sap.app": {
                        "id": "com.sap.base.app.id",
                        "i18n": "i18n/i18n.properties",
                        "applicationVersion": {
                            "version": "1.0.0"
                        }
                    },
                    "sap.ui5": {
                        models: []
                    }
                })]]);
            const files = await test({
                baseAppFiles,
                appVariantFolder: "integration/appVar4", // AppVariant with enhanceWith change and simple change with same i18n paths
                expectLength: 5,
                expectIncluded: [
                    "/resources/ns/customer_com_sap_application_variant_id/i18n/ListObject/i18n.properties",
                    "/resources/ns/customer_com_sap_application_variant_id/i18n/ListObject/i18n_de.properties",
                    "/resources/ns/i18n/i18n.properties", // merged
                    "/resources/ns/i18n/i18n_de.properties", // merged
                    "/resources/ns/manifest.json"
                ]
            });
            expect(await TestUtil.getResourceByName(files, "i18n/i18n.properties")).to.eql("original\n\n#App variant specific text file\n\nappVariant");
            expect(await TestUtil.getResourceByName(files, "i18n/i18n_de.properties")).to.eql("original de\n\n#App variant specific text file\n\nappVariant de");
        });

        it("should not change the properties not referenced in manifest.json or changes not referenced in manifest/i18n target", async () => {
            const baseAppFiles = new Map([
                ["i18n/doe.properties", "original"],
                ["i18n/doe_de.properties", "original de"],
                ["manifest.json", JSON.stringify({
                    "sap.app": {
                        "id": "com.sap.base.app.id",
                        "i18n": "i18n/hugo.properties",
                        "applicationVersion": {
                            "version": "1.0.0"
                        }
                    },
                    "sap.ui5": {
                        models: []
                    }
                })]]);
            const files = await test({
                baseAppFiles,
                appVariantFolder: "integration/appVar5", // AppVariant with simple change references absence file
                expectLength: 3,
                expectIncluded: [
                    "/resources/ns/i18n/doe.properties",
                    "/resources/ns/i18n/doe_de.properties",
                    "/resources/ns/manifest.json"
                ]
            });
            expect(await TestUtil.getResourceByName(files, "i18n/doe.properties")).to.eql("original");
            expect(await TestUtil.getResourceByName(files, "i18n/doe_de.properties")).to.eql("original de");
        });

        it("should not change the properties not referenced in manifest.json or changes", async () => {
            const baseAppFiles = new Map([
                ["i18n/hugo.properties", "original"],
                ["i18n/hugo_de.properties", "original de"],
                ["manifest.json", JSON.stringify({
                    "sap.app": {
                        "id": "com.sap.base.app.id",
                        "i18n": "i18n/hugo.properties",
                        "applicationVersion": {
                            "version": "1.0.0"
                        }
                    },
                    "sap.ui5": {
                        models: []
                    }
                })]]);
            const files = await test({
                baseAppFiles,
                appVariantFolder: "integration/appVar5", // AppVariant with simple change references absence file
                expectLength: 3,
                expectIncluded: [
                    "/resources/ns/i18n/hugo.properties",
                    "/resources/ns/i18n/hugo_de.properties",
                    "/resources/ns/manifest.json"
                ]
            });
            expect(await TestUtil.getResourceByName(files, "i18n/hugo.properties")).to.eql("original");
            expect(await TestUtil.getResourceByName(files, "i18n/hugo_de.properties")).to.eql("original de");
        });


        it("should not merge non-referenced i18n.properties file", async () => {
            const baseAppFiles = new Map([
                ["manifest.json", JSON.stringify({
                    "sap.app": {
                        "id": "com.sap.base.app.id",
                        "i18n": "i18n/i18n.properties",
                        "applicationVersion": {
                            "version": "1.0.0"
                        }
                    }
                })]]);
            const files = await test({
                baseAppFiles,
                appVariantFolder: "integration/appVar6",
                expectLength: 3,
                expectIncluded: [
                    "/resources/ns/i18n/i18n.properties",
                    "/resources/ns/i18n/i18n_de.properties",
                    "/resources/ns/manifest.json"
                ]
            });

            expect(await TestUtil.getResourceByName(files, "/resources/ns/i18n/i18n.properties")).to.eql("appVariant");
            expect(await TestUtil.getResourceByName(files, "/resources/ns/i18n/i18n_de.properties")).to.eql("appVariant de");
        });


        it("should merge, copy and create a new i18n.properties file", async () => {
            const baseAppFiles = new Map([
                ["manifest.json", JSON.stringify({
                    "sap.app": {
                        "id": "com.sap.base.app.id",
                        "i18n": "i18n/i18n.properties",
                        "applicationVersion": {
                            "version": "1.0.0"
                        }
                    }, "sap.ui5": {
                        models: []
                    }
                })]]);
            const files = await test({
                baseAppFiles,
                appVariantFolder: "integration/appVar7",
                expectLength: 5,
                expectIncluded: [
                    "/resources/ns/i18n/i18n.properties",
                    "/resources/ns/i18n/i18n_de_US.properties",
                    "/resources/ns/customer_com_sap_application_variant_id/i18n/i18n.properties",
                    "/resources/ns/customer_com_sap_application_variant_id/i18n/i18n_de_US.properties",
                    "/resources/ns/manifest.json"
                ]
            });

            expect(await TestUtil.getResourceByName(files, "/resources/ns/i18n/i18n.properties")).to.eql("appVariant");
            expect(await TestUtil.getResourceByName(files, "/resources/ns/i18n/i18n_de_US.properties")).to.eql("appVariant de US");

            expect(await TestUtil.getResourceByName(files, "/resources/ns/customer_com_sap_application_variant_id/i18n/i18n.properties")).to.eql("appVariant");
            expect(await TestUtil.getResourceByName(files, "/resources/ns/customer_com_sap_application_variant_id/i18n/i18n_de_US.properties")).to.eql("appVariant de US");
        });

        async function test({ baseAppFiles, appVariantFolder, expectLength, expectIncluded, expectExcluded }: ITestParams) {
            const cfUtilMock = {
                getOrCreateServiceKeyWithEndpoints: () => Promise.resolve({})
            };

            const CFProcessor = await esmock("../../../../src/processors/cfProcessor.js", {}, {
                "../../../../src/repositories/html5RepoManager.ts": {
                    getBaseAppFiles: () => Promise.resolve(baseAppFiles),
                    getMetadata: () => Promise.resolve({ changedOn: "123" })
                },
                "../../../../src/cache/cacheHolder": {
                    cached: () => { }
                },
                "../../../../src/util/cfUtil.ts": cfUtilMock
            });
            const processor = new CFProcessor(OPTIONS.configuration);
            const index = await esmock("../../../../src/index.js", {}, {
                "../../../../src/processors/processor.js": {
                    determineProcessor: () => processor
                }
            });
            const { workspace, taskUtil } = await TestUtil.getWorkspace(appVariantFolder, OPTIONS.projectNamespace);
            await index({ workspace, options: OPTIONS, taskUtil });
            const files = await workspace.byGlob("/**/*")
                .then((resources: any[]) => resources.filter(TestUtil.byIsOmited(taskUtil)));
            const filenames = files.map((resource: any) => resource.getPath());
            if (expectLength) {
                expect(files.length).to.eq(expectLength);
            }
            if (expectIncluded) {
                expect(filenames).to.include.members(expectIncluded);
            }
            if (expectExcluded) {
                expect(filenames).not.to.include.members(expectExcluded);
            }
            return files;
        }
    });
});

interface ITestParams {
    baseAppFiles: Map<string, string>;
    appVariantFolder: string;
    expectLength?: number;
    expectIncluded?: string[];
    expectExcluded?: string[];
}
