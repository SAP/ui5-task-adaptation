/* eslint-disable @typescript-eslint/no-unused-expressions */
import sinon, { SinonSandbox } from "sinon";

import CacheHolder from "../../../src/cache/cacheHolder.js";
import { IProjectOptions } from "../../../src/model/types.js";
import TestUtil from "../testUtilities/testUtil.js";
import esmock from "esmock";
import { expect } from "chai";

const { byIsOmited } = TestUtil;

describe("FileMerger Unit Test", () => {
    const OPTIONS: IProjectOptions = {
        projectNamespace: "ns",
        configuration: {
            appName: "repoName1"
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
        const CFProcessor = await esmock("../../../src/processors/cfProcessor.js", {}, {
            "../../../src/repositories/html5RepoManager.ts": {
                getBaseAppFiles: () => Promise.resolve(baseAppFiles),
                getMetadata: () => Promise.resolve({ changedOn: "123" })
            },
            "../../../src/cache/cacheHolder": {
                cached: () => { }
            }
        });
        const index = await esmock("../../../src/index.js", {}, {
            "../../../src/processors/processor.js": {
                determineProcessor: () => new CFProcessor(OPTIONS.configuration)
            }
        });
        const { workspace, taskUtil } = await TestUtil.getWorkspace(appVariantFolder, OPTIONS.projectNamespace);
        await index({ workspace, options: OPTIONS, taskUtil });
        const files = await workspace.byGlob("/**/*")
            .then((resources: any[]) => resources.filter(byIsOmited(taskUtil)));
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


interface ITestParams {
    baseAppFiles: Map<string, string>;
    appVariantFolder: string;
    expectLength?: number;
    expectIncluded?: string[];
    expectExcluded?: string[];
}
