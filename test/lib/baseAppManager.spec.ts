import * as sinon from "sinon";

import { Applier, AppDescriptorChange } from "../../dist/bundle.js";
import { assert, expect } from "chai";

import AbapProcessor from "../../src/processors/abapProcessor.js";
import AbapRepoManager from "../../src/repositories/abapRepoManager.js";
import AnnotationManager from "../../src/annotationManager.js";
import AppVariant from "../../src/appVariantManager.js";
import BaseApp, { preProcessFiles } from "../../src/baseAppManager.js";
import CFProcessor from "../../src/processors/cfProcessor.js"
import { IProjectOptions } from "../../src/model/types.js";
import MockServer from "./testUtilities/mockServer.js";
import { SinonSandbox } from "sinon";
import TestUtil from "./testUtilities/testUtil.js";

describe("BaseAppManager getManifestInfo", () => {

    it("should replace . with / from i18n bundleName", () => {
        const manifestJson = TestUtil.getResource("manifest.json");
        const baseApp = BaseApp.fromFiles(new Map([["manifest.json", manifestJson]]));
        expect(baseApp.i18nPath).to.be.equal("i18n/i18n");
        expect(baseApp.id).to.be.equal("com.sap.base.app.id");
        expect(baseApp.version).to.be.equal("1.0.0");
    });

    it("should not replace .properties from i18n bundleUrl", () => {
        const manifestJson = JSON.parse(TestUtil.getResource("manifest.json"));
        manifestJson["sap.app"]["i18n"] = {
            "bundleUrl": "samplePath/i18n/i18n.properties"
        }
        const baseApp = BaseApp.fromFiles(new Map([["manifest.json", JSON.stringify(manifestJson)]]));
        expect(baseApp.i18nPath).to.be.equal("samplePath/i18n/i18n");
        expect(baseApp.id).to.be.equal("com.sap.base.app.id");
        expect(baseApp.version).to.be.equal("1.0.0");
    });

    it("should replace .properties from i18n bundleUrl path but keep file extension", () => {
        const manifestJson = JSON.parse(TestUtil.getResource("manifest.json"));
        manifestJson["sap.app"]["i18n"] = {
            "bundleUrl": "samplePath.properties/i18n/i18n.properties"
        }
        const baseApp = BaseApp.fromFiles(new Map([["manifest.json", JSON.stringify(manifestJson)]]));
        expect(baseApp.i18nPath).to.be.equal("samplePath.properties/i18n/i18n");
        expect(baseApp.id).to.be.equal("com.sap.base.app.id");
        expect(baseApp.version).to.be.equal("1.0.0");
    });

});

describe("BaseAppManager getBaseAppManifest", () => {
    let sandbox: SinonSandbox;
    const options: IProjectOptions = {
        projectNamespace: "ns",
        configuration: {
            appHostId: "appHostId",
            appId: "appId",
            appName: "appName",
            appVersion: "appVersion",
            space: "spaceGuid",
            org: "orgGuid",
            sapCloudService: "sapCloudService"
        }
    };

    beforeEach(() => sandbox = sinon.createSandbox());
    afterEach(() => sandbox.restore());

    it("should return correct manifest.json from root folder", async () => {
        const baseApp = BaseApp.fromFiles(new Map([
            ["subfolder/manifest.json", TestUtil.getResource("manifest-annotation-only.json")],
            ["manifest.json", TestUtil.getResource("manifest.json")],
            ["component-preload.js", TestUtil.getResource("component-preload.js")]
        ]));
        expect(baseApp.id).to.eql("com.sap.base.app.id");
    });

    it("should apply manifest.json changes first, then *.change files", async () => {
        const appVariant = await TestUtil.getAppVariant("ci.settleman.fcadoc.opgs1", options.projectNamespace);
        const baseApp = BaseApp.fromFiles(new Map([
            ["manifest.json", JSON.stringify({
                "_version": "1.12.0",
                "sap.app": {
                    "id": "ci.settleman.fcadoc.opgs1",
                    "applicationVersion": {
                        "version": "1.0.0"
                    }
                }
            })]
        ]));
        const files = await baseApp.adapt(appVariant, new CFProcessor(options.configuration));
        const inbouds = JSON.parse(files.get("manifest.json")!)["sap.app"].crossNavigation.inbounds;
        expect(Object.keys(inbouds)).to.eql(["customer.ci.settleman.fcadoc.opgs1.InboundID"]);
        expect(inbouds["customer.ci.settleman.fcadoc.opgs1.InboundID"].title).to.eql("ak");
        expect(inbouds["customer.ci.settleman.fcadoc.opgs1.InboundID"].subTitle).to.eql("test");
    });

    it("should throw error in case manifest.json is not in root folder", async () => {
        try {
            BaseApp.fromFiles(new Map([
                ["subfolder/manifest.json", TestUtil.getResource("manifest.json")],
                ["component-preload.js", TestUtil.getResource("component-preload.js")]
            ]));
            assert.fail(true, false, "Exception not thrown");
        } catch (error: any) {
            expect(error.message).to.eql("Original application should have manifest.json in root folder");
        }
    });

    it("should filter files correctly in constructor", () => {
        const inputFiles = new Map([
            ["manifest.json", TestUtil.getResource("manifest.json")],
            ["manifest-bundle.zip", "zip content"],
            ["Component-preload.js", "preload content"],
            ["sap-ui-cachebuster-info.json", "cachebuster content"],
            ["Component-dbg.js", "debug content"],
            ["Component.js", "production content"],
            ["Controller-dbg.js", "debug only content"],
            ["regular-file.js", "regular content"]
        ]);

        const baseApp = BaseApp.fromFiles(inputFiles);

        // Should include: manifest.json, Component.js (with debug content), Controller-dbg.js (no corresponding .js), regular-file.js
        // Should exclude: manifest-bundle.zip, Component-preload.js, sap-ui-cachebuster-info.json, Component-dbg.js (deleted because Component.js exists)
        const resultKeys = Array.from(baseApp.files.keys());
        expect(resultKeys).to.have.members([
            "manifest.json",
            "Component.js",
            "Controller-dbg.js",
            "regular-file.js"
        ]);

        // Verify that Component.js content has been replaced with Component-dbg.js content
        expect(baseApp.files.get("Component.js")).to.equal("debug content");
        expect(baseApp.files.get("Controller-dbg.js")).to.equal("debug only content");
        expect(baseApp.files.get("regular-file.js")).to.equal("regular content");
    });
});

describe("BaseAppManager CF", () => {
    let sandbox: SinonSandbox;
    const options: IProjectOptions = {
        projectNamespace: "ns",
        configuration: {
            appHostId: "appHostId",
            appId: "appId",
            appName: "appName",
            appVersion: "appVersion",
            space: "spaceGuid",
            org: "orgGuid",
            sapCloudService: "sapCloudService"
        }
    };

    beforeEach(async () => sandbox = sinon.createSandbox());
    afterEach(() => sandbox.restore());


    it("should update base app manifest", async () => {
        const baseApp = BaseApp.fromFiles(new Map([
            ["manifest.json", TestUtil.getResource("manifest.json")],
            ["component-preload.js", TestUtil.getResource("component-preload.js")]
        ]));
        const appVariant = await TestUtil.getAppVariant("appVariant1", options.projectNamespace);
        const files = await baseApp.adapt(appVariant, new CFProcessor(options.configuration));
        const actualManifest = JSON.parse(files.get("manifest.json")!);
        const actualCPreload = files.get("component-preload.js");
        expect(actualManifest).to.eql(JSON.parse(TestUtil.getResource("manifest-expected-cf.json")));
        expect(actualCPreload).to.eql(TestUtil.getResource("component-preload-expected.js"));
        assertManifestInfo(files);
    });

    it("should skip base app files", async () => {
        const baseApp = BaseApp.fromFiles(new Map([
            ["manifest.json", TestUtil.getResource("manifest.json")],
            ["manifest-bundle.zip", ""],
            ["Component-preload.js", ""],
            ["sap-ui-cachebuster-info.json", ""],
            ["Component-dbg.js", "debug content"],
            ["Component.js", "production content"],
            ["Controller-dbg.js", "debug only content"]
        ]));
        const appVariant = await TestUtil.getAppVariant("appVariant1", options.projectNamespace);
        const files = await baseApp.adapt(appVariant, new CFProcessor(options.configuration));
        // Should include manifest.json, Component.js, and Controller-dbg.js (no corresponding .js)
        // Should exclude manifest-bundle.zip, Component-preload.js, sap-ui-cachebuster-info.json, Component-dbg.js
        expect(Array.from(files.keys())).to.have.members(["manifest.json", "Component.js", "Controller-dbg.js"]);
        assertManifestInfo(files);
    });

    it("should validate sap.app/id", async () => {
        const appVariant = await TestUtil.getAppVariant("appVariant1", options.projectNamespace);
        await assertValidation(appVariant, options, "Original application manifest should have sap.app/id", {});
    });

    it("should validate sap.app/applicationVersion/version", async () => {
        const appVariant = await TestUtil.getAppVariant("appVariant1", options.projectNamespace);
        await assertValidation(appVariant, options, "Original application manifest should have sap.app/applicationVersion/version", {
            "sap.app": { id: "base.id" }
        });
    });

    it("should delete 'sap.cloud' if sapCloudService is not presented in config", async () => {
        const appVariant = await TestUtil.getAppVariant("appVariant1", options.projectNamespace);
        const baseApp = BaseApp.fromFiles(new Map([["manifest.json", TestUtil.getResource("manifest.json")]]));
        const optionsClone = { ...options, configuration: { ...options.configuration } };
        delete optionsClone.configuration["sapCloudService"];
        const files = await baseApp.adapt(appVariant, new CFProcessor(optionsClone.configuration));
        const manifest = JSON.parse(files.get("manifest.json")!);
        expect(manifest["sap.cloud"]).to.be.undefined;
        assertManifestInfo(files);
    });

    it("should create default 'sap.cloud'", async () => {
        const appVariant = await TestUtil.getAppVariant("appVariant1", options.projectNamespace);
        const baseAppManifest = TestUtil.getResourceJson("manifest.json");
        delete baseAppManifest["sap.cloud"];
        const baseApp = BaseApp.fromFiles(new Map([["manifest.json", JSON.stringify(baseAppManifest)]]));
        const files = await baseApp.adapt(appVariant, new CFProcessor(options.configuration));
        const manifest = JSON.parse(files.get("manifest.json")!);
        expect(manifest["sap.cloud"]).to.eql({ service: "sapCloudService" });
        assertManifestInfo(files);
    });

    it("should fill change layer", async () => {
        const appVariant = await TestUtil.getAppVariant("appVariant1", options.projectNamespace);
        const baseApp = BaseApp.fromFiles(new Map([["manifest.json", TestUtil.getResource("manifest.json")]]));
        const stub = sandbox.stub(Applier, "applyChanges")!;
        await baseApp.adapt(appVariant, new CFProcessor(options.configuration));
        const layers = stub.getCall(0).args[1].map((change: AppDescriptorChange) => change.getLayer());
        expect(layers.every((layer: string) => layer === "CUSTOMER_BASE")).to.be.true;
    });

    it("shouldn't delete cloudDevAdaptationStatus if not in manifest", async () => {
        const applyDescriptorChangesStub = await updateManifest((manifestJson) => {
            delete manifestJson["sap.fiori"];
        });
        expect(applyDescriptorChangesStub.getCall(0).args[0]["sap.fiori"]).to.be.undefined;
    });

    it("shouldn't delete cloudDevAdaptationStatus if not in manifest", async () => {
        const applyDescriptorChangesStub = await updateManifest((manifestJson) => {
            delete manifestJson["sap.fiori"].cloudDevAdaptationStatus;
        });
        expect(applyDescriptorChangesStub.getCall(0).args[0]["sap.fiori"]).to.eql({
            abstract: true,
            archeType: "transactional",
            registrationIds: [
                "F1234"
            ]
        });
    });

    it("shouldn't delete cloudDevAdaptationStatus if not in manifest", async () => {
        const applyDescriptorChangesStub = await updateManifest((manifestJson) => {
            delete manifestJson["sap.ui5"];
        });
        expect(applyDescriptorChangesStub.getCall(0).args[0]["sap.ui5"]).to.eql({
            appVariantIdHierarchy: [
                {
                    appVariantId: "com.sap.base.app.id",
                    version: "1.0.0"
                }
            ],
            isCloudDevAdaptation: true
        });
    });

    const assertValidation = async (appVariant: AppVariant, options: IProjectOptions, expectedError: string, manifest: any) => {
        try {
            const baseApp = BaseApp.fromFiles(new Map([["manifest.json", JSON.stringify(manifest)]]));
            await baseApp.adapt(appVariant, new CFProcessor(options.configuration));
            assert.fail(true, false, "Exception not thrown");
        } catch (error: any) {
            expect(error.message).to.equal(expectedError);
        }
    }

    async function updateManifest(action: (manifest: any) => void) {
        const manifestJson = TestUtil.getResourceJson("manifest.json");
        action(manifestJson);
        const baseApp = BaseApp.fromFiles(new Map([["manifest.json", JSON.stringify(manifestJson)]]));
        const applyDescriptorChangesStub = sandbox.stub(baseApp, "applyDescriptorChanges" as any);
        const appVariant = await TestUtil.getAppVariant("appVariant1", options.projectNamespace);
        await baseApp.adapt(appVariant, new CFProcessor(options.configuration));
        return applyDescriptorChangesStub;
    }
});

describe("BaseAppManager Abap", () => {
    let appVariant: AppVariant;
    let sandbox: SinonSandbox;

    const options: IProjectOptions = {
        projectNamespace: "ns",
        configuration: {
            type: "abap",
            appName: "appName",
            destination: "system",
            languages: ["EN", "FR", "DE"],
            enableBetaFeatures: true
        }
    };
    const abapRepoManager = new AbapRepoManager(options.configuration);
    const annotationManager = new AnnotationManager(options.configuration, abapRepoManager);
    const abapProcessor = new AbapProcessor(options.configuration, abapRepoManager, annotationManager);

    beforeEach(async () => sandbox = sinon.createSandbox());
    afterEach(() => sandbox.restore());

    before(async () => {
        appVariant = await TestUtil.getAppVariant("appVariant1", options.projectNamespace);
        sandbox = sinon.createSandbox();
        MockServer.stubAnnotations(sandbox, abapRepoManager, [
            {
                folder: "annotations/v2/annotation-1-v2",
                url: "/sap/opu/odata4/sap/f4_fv_airlines_mduu_04/utyr/sap/f4_sd_airlines_mduu/0001/"
            },
            {
                folder: "annotations/v2/annotation-2-v2",
                url: "/sap/opu/odata4/sap/f4_fv_airlines_mduu_04/utyr/sap/f4_sd_airlines_mduu/0002/annotation.xml"
            },
            {
                folder: "annotations/v2/annotation-3-v2-child",
                url: "/sap/opu/odata/sap/M2_SB_TRAVEL_MDUU_02/$metadata"
            },
            {
                folder: "annotations/v2/annotation-3-v2-child",
                url: "/sap/opu/odata/sap/M2_SB_TRAVEL_MDUU_02/$metadata"
            }
        ]);
    });

    it("should update base app manifest", async () => {
        const baseApp = BaseApp.fromFiles(new Map([
            ["manifest.json", TestUtil.getResource("manifest.json")],
            ["component-preload.js", TestUtil.getResource("component-preload.js")]
        ]));
        const files = await baseApp.adapt(appVariant, abapProcessor);
        const actualManifest = JSON.parse(files.get("manifest.json")!);
        const actualCPreload = files.get("component-preload.js");
        expect(actualManifest).to.eql(JSON.parse(TestUtil.getResource("manifest-expected-abap.json")));
        expect(actualCPreload).to.eql(TestUtil.getResource("component-preload-expected.js"));
        assertAnnotations(files, 8);
        assertManifestInfo(files);
    });

    it("should skip base app files", async () => {
        const baseApp = BaseApp.fromFiles(new Map([
            ["manifest.json", TestUtil.getResource("manifest.json")],
            ["manifest-bundle.zip", ""],
            ["Component-preload.js", ""],
            ["sap-ui-cachebuster-info.json", ""],
            ["Component-dbg.js", "debug content"],
            ["Component.js", "production content"],
            ["Controller-dbg.js", "debug only content"]
        ]));
        const files = await baseApp.adapt(appVariant, abapProcessor);
        assertAnnotations(files, 9); // Updated count to include Component.js and Controller-dbg.js
        expect(Array.from(files.keys())).to.have.members([
            "manifest.json",
            "Component.js",
            "Controller-dbg.js",
            "annotations/annotation_annotationName1.xml",
            "i18n/annotations/customercomsapapplicationvariantid/i18n.properties",
            "i18n/annotations/customercomsapapplicationvariantid/i18n_en.properties",
            "i18n/annotations/customercomsapapplicationvariantid/i18n_de.properties",
            "i18n/annotations/customercomsapapplicationvariantid/i18n_fr.properties",
            "annotations/annotation_annotationName2.xml"
        ]);
        assertManifestInfo(files);
    });

    it("should validate sap.app/id", async () => {
        await assertValidation(appVariant, "Original application manifest should have sap.app/id", {});
    });

    it("should validate sap.app/applicationVersion/version", async () => {
        await assertValidation(appVariant, "Original application manifest should have sap.app/applicationVersion/version", {
            "sap.app": { id: "base.id" }
        });
    });

    it("should delete 'sap.cloud' if sapCloudService is not presented in config", async () => {
        const baseApp = BaseApp.fromFiles(new Map([["manifest.json", TestUtil.getResource("manifest.json")]]));
        const optionsClone = { ...options, configuration: { ...options.configuration } };
        delete optionsClone.configuration["sapCloudService"];
        const files = await baseApp.adapt(appVariant, abapProcessor);
        const manifest = JSON.parse(files.get("manifest.json")!);
        expect(manifest["sap.cloud"]).to.eql({ service: "com.sap.manifest.default.service", public: true });
        assertAnnotations(files, 7);
        assertManifestInfo(files);
    });

    it("should create default 'sap.cloud'", async () => {
        const baseAppManifest = JSON.parse(TestUtil.getResource("manifest.json"));
        delete baseAppManifest["sap.cloud"];
        const baseApp = BaseApp.fromFiles(new Map([["manifest.json", JSON.stringify(baseAppManifest)]]));
        const files = await baseApp.adapt(appVariant, abapProcessor);
        const manifest = JSON.parse(files.get("manifest.json")!);
        expect(manifest["sap.cloud"]).to.be.undefined;
        assertAnnotations(files, 7);
        assertManifestInfo(files);
    });

    it("should fill change layer", async () => {
        const baseApp = BaseApp.fromFiles(new Map([["manifest.json", TestUtil.getResource("manifest.json")]]));
        const stub = sandbox.stub(Applier, "applyChanges")!;
        await baseApp.adapt(appVariant, abapProcessor);
        const layers = stub.getCall(0).args[1].map((change: AppDescriptorChange) => change.getLayer());
        expect(layers.every((layer: string) => layer === "CUSTOMER_BASE")).to.be.true;
    });

    it("should throw an error because of one-segment id", async () => {
        const manifest = JSON.stringify({
            "sap.app": {
                "id": "segment"
            }
        });
        expect(() => BaseApp.fromFiles(new Map([["manifest.json", manifest]]))).to.throw(
            "The original application id 'segment' should consist of multiple segments split by dot, e.g.: original.id");
    });

    const assertValidation = async (appVariant: AppVariant, expectedError: string, manifest: any) => {
        try {
            const baseApp = BaseApp.fromFiles(new Map([["manifest.json", JSON.stringify(manifest)]]));
            await baseApp.adapt(appVariant, abapProcessor);
            assert.fail(true, false, "Exception not thrown");
        } catch (error: any) {
            expect(error.message).to.equal(expectedError);
        }
    }

});


function assertManifestInfo(files: ReadonlyMap<string, string>) {
    const sapApp = JSON.parse(files.get("manifest.json")!)["sap.app"];
    expect(sapApp.id).to.eql("customer.com.sap.application.variant.id");
    expect(sapApp.applicationVersion.version).to.eql("1.0.0");
}

function assertAnnotations(files: ReadonlyMap<string, string>, resourceCountExpected: number) {
    const annotationName1Expected = TestUtil.getResourceXml("annotations/v2/annotation-1-v2-expected/annotationName1-expected.xml");
    const annotationName2Expected = TestUtil.getResourceXml("annotations/v2/annotation-2-v2-expected/annotationName2-expected.xml");
    const name1i18nDf = files.get("i18n/annotations/customercomsapapplicationvariantid/i18n.properties");
    const name1i18nEn = files.get("i18n/annotations/customercomsapapplicationvariantid/i18n_en.properties");
    const name1i18nDe = files.get("i18n/annotations/customercomsapapplicationvariantid/i18n_de.properties");
    const name1i18nFr = files.get("i18n/annotations/customercomsapapplicationvariantid/i18n_fr.properties");
    const annotationName1Actual = files.get("annotations/annotation_annotationName1.xml");
    const annotationName2Actual = files.get("annotations/annotation_annotationName2.xml");
    expect(files.size).to.eql(resourceCountExpected);
    expect(name1i18nDf!.split("\n")).to.have.members([
        "customer.com.sap.application.variant.id_CALCULATETOTALPRICE=calculateTotalPrice",
        "customer.com.sap.application.variant.id_AIRLINE=Airline",
        "customer.com.sap.application.variant.id_AIRLINE0=Airline",
        "customer.com.sap.application.variant.id_CUSTOMER=Customer",
        "customer.com.sap.application.variant.id_CUSTOMER_VALUE_1=Customer Value 1",
        "customer.com.sap.application.variant.id_CURRENCY=currency",
        "customer.com.sap.application.variant.id_METADATA=Metadata",
        "customer.com.sap.application.variant.id_CDS_M2_SD_TRAVEL_MDUU=cds_m2_sd_travel_mduu",
        "customer.com.sap.application.variant.id_CURRENCY0=currency"
    ]);
    expect(name1i18nEn!.split("\n")).to.have.members([
        "customer.com.sap.application.variant.id_CALCULATETOTALPRICE=calculateTotalPrice",
        "customer.com.sap.application.variant.id_AIRLINE=Airline",
        "customer.com.sap.application.variant.id_AIRLINE0=Airline",
        "customer.com.sap.application.variant.id_CUSTOMER=Customer",
        "customer.com.sap.application.variant.id_CUSTOMER_VALUE_1=Customer Value 1",
        "customer.com.sap.application.variant.id_CURRENCY=currency",
        "customer.com.sap.application.variant.id_METADATA=Metadata",
        "customer.com.sap.application.variant.id_CDS_M2_SD_TRAVEL_MDUU=cds_m2_sd_travel_mduu",
        "customer.com.sap.application.variant.id_CURRENCY0=currency"
    ]);
    expect(name1i18nDe!.split("\n")).to.have.members([
        "customer.com.sap.application.variant.id_CALCULATETOTALPRICE=calculateTotalPrice",
        "customer.com.sap.application.variant.id_AIRLINE=Fluglinie",
        "customer.com.sap.application.variant.id_AIRLINE0=Fluglinie",
        "customer.com.sap.application.variant.id_CUSTOMER=Kunde",
        "customer.com.sap.application.variant.id_CUSTOMER_VALUE_1=KundeWert",
        "customer.com.sap.application.variant.id_CURRENCY=währung",
        "customer.com.sap.application.variant.id_METADATA=Metadaten",
        "customer.com.sap.application.variant.id_CDS_M2_SD_TRAVEL_MDUU=cds_m2_sd_reise_mduu",
        "customer.com.sap.application.variant.id_CURRENCY0=währung"
    ]);
    expect(name1i18nFr!.split("\n")).to.have.members([
        "customer.com.sap.application.variant.id_CALCULATETOTALPRICE=calculer le prix total",
        "customer.com.sap.application.variant.id_AIRLINE=Compagnie aérienne",
        "customer.com.sap.application.variant.id_AIRLINE0=Compagnie aérienne",
        "customer.com.sap.application.variant.id_CUSTOMER=Client",
        "customer.com.sap.application.variant.id_CUSTOMER_VALUE_1=Client valeur",
        "customer.com.sap.application.variant.id_CURRENCY=monnaie",
        "customer.com.sap.application.variant.id_METADATA=Metadonnees",
        "customer.com.sap.application.variant.id_CDS_M2_SD_TRAVEL_MDUU=cds_m2_sd_voyager_mduu",
        "customer.com.sap.application.variant.id_CURRENCY0=monnaie"
    ]);
    expect(annotationName1Actual).to.be.eql(annotationName1Expected);
    expect(annotationName2Actual).to.be.eql(annotationName2Expected);
}

describe("extractI18nPathFromManifest", () => {
    it("should return i18n path from i18n string", () => assert("foo/bar.properties", "foo/bar"));
    it("should return i18n path from bundleUrl", () => assert({ bundleUrl: "foo/bar.properties" }, "foo/bar"));
    it("should return i18n path from bundleName", () => assert({ bundleName: "com.sap.base.app.id.foo.bar" }, "foo/bar"));
    it("should return i18n path from empty object", () => assert({}, "i18n/i18n"));
    it("should return i18n path from absent i18n", () => assert(undefined, "i18n/i18n"));
    const assert = (i18n: any, expected: string) => {
        const manifest = JSON.stringify({
            "sap.app": {
                "id": "com.sap.base.app.id",
                "i18n": i18n,
                "applicationVersion": {
                    "version": "1.0.0"
                }
            }
        });
        expect(BaseApp.fromFiles(new Map([["manifest.json", manifest]])).i18nPath).to.be.equal(expected);
    }
});


describe("preProcessFiles", () => {

    it("should replace .js file content with -dbg.js content and delete -dbg.js when both exist", () => {
        const files = new Map([
            ["Component.js", "production content"],
            ["Component-dbg.js", "debug content"],
            ["regular-file.js", "regular content"]
        ]);

        const result = preProcessFiles(files);

        expect(result.get("Component.js")).to.equal("debug content");
        expect(result.has("Component-dbg.js")).to.be.false; // Should be deleted
        expect(result.get("regular-file.js")).to.equal("regular content");
    });

    it("should not modify .js files when no corresponding -dbg.js exists", () => {
        const files = new Map([
            ["Component.js", "production content"],
            ["regular-file.js", "regular content"]
        ]);

        const result = preProcessFiles(files);

        expect(result.get("Component.js")).to.equal("production content");
        expect(result.get("regular-file.js")).to.equal("regular content");
    });

    it("should keep -dbg.js files when no corresponding .js exists", () => {
        const files = new Map([
            ["Component-dbg.js", "debug content"],
            ["regular-file.js", "regular content"]
        ]);

        const result = preProcessFiles(files);

        expect(result.get("Component-dbg.js")).to.equal("debug content");
        expect(result.get("regular-file.js")).to.equal("regular content");
    });

    it("should handle multiple -dbg.js files correctly", () => {
        const files = new Map([
            ["Component.js", "production component"],
            ["Component-dbg.js", "debug component"],
            ["Controller.js", "production controller"],
            ["Controller-dbg.js", "debug controller"],
            ["View-dbg.js", "debug view only"],
            ["regular-file.js", "regular content"]
        ]);

        const result = preProcessFiles(files);

        expect(result.get("Component.js")).to.equal("debug component");
        expect(result.has("Component-dbg.js")).to.be.false; // Should be deleted
        expect(result.get("Controller.js")).to.equal("debug controller");
        expect(result.has("Controller-dbg.js")).to.be.false; // Should be deleted
        expect(result.get("View-dbg.js")).to.equal("debug view only"); // Kept (no corresponding .js)
        expect(result.get("regular-file.js")).to.equal("regular content");
    });

    it("should handle nested file paths correctly", () => {
        const files = new Map([
            ["folder/Component.js", "production content"],
            ["folder/Component-dbg.js", "debug content"],
            ["folder/subfolder/Controller.js", "production controller"],
            ["folder/subfolder/Controller-dbg.js", "debug controller"]
        ]);

        const result = preProcessFiles(files);

        expect(result.get("folder/Component.js")).to.equal("debug content");
        expect(result.has("folder/Component-dbg.js")).to.be.false; // Should be deleted
        expect(result.get("folder/subfolder/Controller.js")).to.equal("debug controller");
        expect(result.has("folder/subfolder/Controller-dbg.js")).to.be.false; // Should be deleted
    });

    it("should remove IGNORE_FILES", () => {
        const files = new Map([
            ["manifest.json", "manifest content"],
            ["manifest-bundle.zip", "bundle content"],
            ["Component-preload.js", "preload content"],
            ["sap-ui-cachebuster-info.json", "cachebuster content"],
            ["regular-file.js", "regular content"]
        ]);

        const result = preProcessFiles(files);

        expect(result.get("manifest.json")).to.equal("manifest content");
        expect(result.has("manifest-bundle.zip")).to.be.false; // Should be deleted
        expect(result.has("Component-preload.js")).to.be.false; // Should be deleted
        expect(result.has("sap-ui-cachebuster-info.json")).to.be.false; // Should be deleted
        expect(result.get("regular-file.js")).to.equal("regular content");
    });

    it("should return a new Map and not modify the original", () => {
        const files = new Map([
            ["Component.js", "production content"],
            ["Component-dbg.js", "debug content"]
        ]);

        const result = preProcessFiles(files);

        // Original should be unchanged
        expect(files.get("Component.js")).to.equal("production content");
        expect(files.get("Component-dbg.js")).to.equal("debug content");
        // Result should have the replaced content and deleted -dbg.js
        expect(result.get("Component.js")).to.equal("debug content");
        expect(result.has("Component-dbg.js")).to.be.false;
        // Should be different Map instances
        expect(result).to.not.equal(files);
    });

    it("should remove -dbg.js.map if corresponding .js file exists", () => {
        const files = new Map([
            ["Component.js", "production content"],
            ["Component-dbg.js.map", "debug map content"],
            ["Component-dbg.js", "debug content"],
            ["regular-file.js", "regular content"],
            ["regular-file-dbg.js.map", "debug map content 2"]
        ]);

        const result = preProcessFiles(files);

        // -dbg.js.map should be removed if .js exists
        expect(result.has("Component-dbg.js.map")).to.be.false;
        // -dbg.js should be removed if .js exists
        expect(result.has("Component-dbg.js")).to.be.false;
        // .js should have debug content
        expect(result.get("Component.js")).to.equal("debug content");
        // regular-file-dbg.js.map should be removed (regular-file.js exists)
        expect(result.has("regular-file-dbg.js.map")).to.be.false;
        // regular-file.js should be untouched
        expect(result.get("regular-file.js")).to.equal("regular content");
    });
});