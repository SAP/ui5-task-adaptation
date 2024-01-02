import * as chai from "chai";
import * as sinon from "sinon";

import BaseAppManager, { IManifestInfo } from "../src/baseAppManager";
import { IAppVariantInfo, IProjectOptions } from "../src/model/types";

import AbapProcessor from "../src/processors/abapProcessor";
import AbapRepoManager from "../src/repositories/abapRepoManager";
import AnnotationManager from "../src/annotationManager";
import BaseAppFilesCacheManager from "../src/cache/baseAppFilesCacheManager";
import CFProcessor from "../src/processors/cfProcessor"
import MockServer from "./testUtilities/mockServer";
import { SinonSandbox } from "sinon";
import TestUtil from "./testUtilities/testUtil";

const { Applier, Change } = require("../dist/bundle");

const { expect, assert } = chai;

describe("BaseAppManager getManifestInfo", () => {

    it("should replace . with / from i18n bundleName", async () => {
        const manifestJson = JSON.parse(TestUtil.getResource("manifest.json"));
        const { i18nPath, id, version } = BaseAppManager.getManifestInfo(manifestJson);
        expect(i18nPath).to.be.equal("com/sap/base/app/id/i18n/i18n.properties");
        expect(id).to.be.equal("com.sap.base.app.id");
        expect(version).to.be.equal("1.0.0");
    });
    
    it("should not replace .properties from i18n bundleUrl", async () => {
        const manifestJson = JSON.parse(TestUtil.getResource("manifest.json"));
        manifestJson["sap.app"]["i18n"] = {
            "bundleUrl": "samplePath/i18n/i18n.properties"
        }
        const { i18nPath, id, version } = BaseAppManager.getManifestInfo(manifestJson);
        expect(i18nPath).to.be.equal("samplePath/i18n/i18n");
        expect(id).to.be.equal("com.sap.base.app.id");
        expect(version).to.be.equal("1.0.0");
    });

    it("should replace .properties from i18n bundleUrl path but keep file extension", async () => {
        const manifestJson = JSON.parse(TestUtil.getResource("manifest.json"));
        manifestJson["sap.app"]["i18n"] = {
            "bundleUrl": "samplePath.properties/i18n/i18n.properties"
        }
        const { i18nPath, id, version } = BaseAppManager.getManifestInfo(manifestJson);
        expect(i18nPath).to.be.equal("samplePath.properties/i18n/i18n");
        expect(id).to.be.equal("com.sap.base.app.id");
        expect(version).to.be.equal("1.0.0");
    });

});

describe("BaseAppManager CF", () => {
    let appVariantInfo: IAppVariantInfo;
    let sandbox: SinonSandbox;
    const options: IProjectOptions = {
        projectNamespace: "ns",
        configuration: {
            appHostId: "appHostId",
            appId: "appId",
            appName: "appName",
            appVersion: "appVersion",
            spaceGuid: "spaceGuid",
            orgGuid: "orgGuid",
            sapCloudService: "sapCloudService"
        }
    };
    const baseAppCacheManager = new BaseAppFilesCacheManager(options.configuration);

    beforeEach(async () => sandbox = sinon.createSandbox());
    afterEach(() => sandbox.restore());

    before(async () => {
        appVariantInfo = await TestUtil.getAppVariantInfo("appVariant1", options.projectNamespace);
    });

    it("should update base app manifest", async () => {
        const baseAppFiles = new Map([
            ["manifest.json", TestUtil.getResource("manifest.json")],
            ["component-preload.js", TestUtil.getResource("component-preload.js")]
        ]);
        const { resources, manifestInfo } = await BaseAppManager.process(baseAppFiles, appVariantInfo, options, new CFProcessor(options.configuration, baseAppCacheManager));
        const actualManifest = await TestUtil.getResourceJsonByName(resources, "manifest.json");
        const actualCPreload = await TestUtil.getResourceByName(resources, "component-preload.js");
        expect(actualManifest).to.eql(JSON.parse(TestUtil.getResource("manifest-expected-cf.json")));
        expect(actualCPreload).to.eql(TestUtil.getResource("component-preload-expected.js"));
        assertManifestInfo(manifestInfo);
    });

    it("should skip base app files", async () => {
        const baseAppFiles = new Map([
            ["/manifest.json", TestUtil.getResource("manifest.json")],
            ["/manifest-bundle.zip", ""],
            ["/Component-preload.js", ""],
            ["/sap-ui-cachebuster-info.json", ""]
        ]);
        const { resources, manifestInfo } = await BaseAppManager.process(baseAppFiles, appVariantInfo, options, new CFProcessor(options.configuration, baseAppCacheManager));
        expect(resources.map(res => res.getPath())).to.have.members(["/resources/ns/manifest.json"]);
        assertManifestInfo(manifestInfo);
    });

    it("should validate sap.app/id", async () => {
        await assertValidation(appVariantInfo, options, "Original application manifest should have sap.app/id", {});
    });

    it("should validate sap.app/applicationVersion/version", async () => {
        await assertValidation(appVariantInfo, options, "Original application manifest should have sap.app/applicationVersion/version", {
            "sap.app": { id: "id" }
        });
    });

    it("should delete 'sap.cloud' if sapCloudService is not presented in config", async () => {
        const baseAppFiles = new Map([["/manifest.json", TestUtil.getResource("manifest.json")]]);
        const optionsClone = { ...options, configuration: { ...options.configuration } };
        delete optionsClone.configuration["sapCloudService"];
        const { resources, manifestInfo } = await BaseAppManager.process(baseAppFiles, appVariantInfo, optionsClone, new CFProcessor(optionsClone.configuration, baseAppCacheManager));
        const actual = await resources[0].getBuffer().then((buffer: Buffer) => JSON.parse(buffer.toString()));
        expect(actual["sap.cloud"]).to.be.undefined;
        assertManifestInfo(manifestInfo);
    });

    it("should create default 'sap.cloud'", async () => {
        const baseAppManifest = JSON.parse(TestUtil.getResource("manifest.json"));
        delete baseAppManifest["sap.cloud"];
        const baseAppFiles = new Map([["/manifest.json", JSON.stringify(baseAppManifest)]]);
        const { resources, manifestInfo } = await BaseAppManager.process(baseAppFiles, appVariantInfo, options, new CFProcessor(options.configuration, baseAppCacheManager));
        const actual = await resources[0].getBuffer().then((buffer: Buffer) => JSON.parse(buffer.toString()));
        expect(actual["sap.cloud"]).to.eql({ service: "sapCloudService" });
        assertManifestInfo(manifestInfo);
    });

    it("should fill change layer", async () => {
        const baseAppFiles = new Map([["manifest.json", TestUtil.getResource("manifest.json")]]);
        const stub = sandbox.stub(Applier, "applyChanges")!;
        await BaseAppManager.process(baseAppFiles, appVariantInfo, options, new CFProcessor(options.configuration, baseAppCacheManager));
        const layers = stub.getCall(0).args[1].map((change: typeof Change) => change.getLayer());
        expect(layers.every((layer: string) => layer === "CUSTOMER_BASE")).to.be.true;
    });

    it("shouldn't fill change layer if layer is undefined", async () => {
        const baseAppFiles = new Map([["manifest.json", TestUtil.getResource("manifest.json")]]);
        const stub = sandbox.stub(Applier, "applyChanges");
        const appVariantInfo = await TestUtil.getAppVariantInfo("appVariant1", options.projectNamespace);
        delete appVariantInfo.manifest["layer"];
        await BaseAppManager.process(baseAppFiles, appVariantInfo, options, new CFProcessor(options.configuration, baseAppCacheManager));
        const definitionKeys = stub.getCall(0).args[1].map((change: typeof Change) => Object.keys(change._oDefinition));
        expect(definitionKeys.every((key: string[]) => !key.includes("layer"))).to.be.true;
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

    const assertValidation = async (appVariantInfo: IAppVariantInfo, options: IProjectOptions, expectedError: string, manifest: any) => {
        try {
            await BaseAppManager.process(new Map([["/manifest.json", JSON.stringify(manifest)]]), appVariantInfo, options, new CFProcessor(options.configuration, baseAppCacheManager));
            assert.fail(true, false, "Exception not thrown");
        } catch (error: any) {
            expect(error.message).to.equal(expectedError);
        }
    }

    async function updateManifest(action: (manifest: any) => void) {
        const manifestJson = JSON.parse(TestUtil.getResource("manifest.json"));
        action(manifestJson);
        const baseAppFiles = new Map([["manifest.json", JSON.stringify(manifestJson)]]);
        const applyDescriptorChangesStub = sandbox.stub(BaseAppManager, "applyDescriptorChanges");
        const appVariantInfo = await TestUtil.getAppVariantInfo("appVariant1", options.projectNamespace);
        await BaseAppManager.process(baseAppFiles, appVariantInfo, options, new CFProcessor(options.configuration, baseAppCacheManager));
        return applyDescriptorChangesStub;
    }
});

describe("BaseAppManager Abap", () => {
    let appVariantInfo: IAppVariantInfo;
    let sandbox: SinonSandbox;
    const options: IProjectOptions = {
        projectNamespace: "ns",
        configuration: {
            type: "abap",
            appName: "appName",
            destination: "system",
            languages: ["EN", "FR", "DE"]
        }
    };
    const baseAppCacheManager = new BaseAppFilesCacheManager(options.configuration);
    const abapRepoManager = new AbapRepoManager(options.configuration);
    const annotationManager = new AnnotationManager(options.configuration, abapRepoManager);
    const abapProcessor = new AbapProcessor(options.configuration, baseAppCacheManager, abapRepoManager, annotationManager);

    beforeEach(async () => sandbox = sinon.createSandbox());
    afterEach(() => sandbox.restore());

    before(async () => {
        appVariantInfo = await TestUtil.getAppVariantInfo("appVariant1", options.projectNamespace);
        sandbox = sinon.createSandbox();
        MockServer.stubAnnotations(sandbox, abapRepoManager);
    });

    it("should update base app manifest", async () => {
        const baseAppFiles = new Map([
            ["manifest.json", TestUtil.getResource("manifest.json")],
            ["component-preload.js", TestUtil.getResource("component-preload.js")]
        ]);
        const { resources, manifestInfo } = await BaseAppManager.process(baseAppFiles, appVariantInfo, options, abapProcessor);
        const actualManifest = await TestUtil.getResourceJsonByName(resources, "manifest.json");
        const actualCPreload = await TestUtil.getResourceByName(resources, "component-preload.js");
        expect(actualManifest).to.eql(JSON.parse(TestUtil.getResource("manifest-expected-abap.json")));
        expect(actualCPreload).to.eql(TestUtil.getResource("component-preload-expected.js"));
        await assertAnnotations(resources, 8);
        assertManifestInfo(manifestInfo);
    });

    it("should skip base app files", async () => {
        const baseAppFiles = new Map([
            ["/manifest.json", TestUtil.getResource("manifest.json")],
            ["/manifest-bundle.zip", ""],
            ["/Component-preload.js", ""],
            ["/sap-ui-cachebuster-info.json", ""]
        ]);
        const { resources, manifestInfo } = await BaseAppManager.process(baseAppFiles, appVariantInfo, options, abapProcessor);
        await assertAnnotations(resources, 7);
        expect(resources.map(res => res.getPath())).to.have.members([
            "/resources/ns/manifest.json",
            "/resources/ns/annotations/annotation_annotationName1.xml",
            "/resources/ns/i18n/annotations/customercomsapapplicationvariantid/i18n.properties",
            "/resources/ns/i18n/annotations/customercomsapapplicationvariantid/i18n_en.properties",
            "/resources/ns/i18n/annotations/customercomsapapplicationvariantid/i18n_de.properties",
            "/resources/ns/i18n/annotations/customercomsapapplicationvariantid/i18n_fr.properties",
            "/resources/ns/annotations/annotation_annotationName2.xml"
        ]);
        assertManifestInfo(manifestInfo);
    });

    it("should validate sap.app/id", async () => {
        await assertValidation(appVariantInfo, options, "Original application manifest should have sap.app/id", {});
    });

    it("should validate sap.app/applicationVersion/version", async () => {
        await assertValidation(appVariantInfo, options, "Original application manifest should have sap.app/applicationVersion/version", {
            "sap.app": { id: "id" }
        });
    });

    it("should delete 'sap.cloud' if sapCloudService is not presented in config", async () => {
        const baseAppFiles = new Map([["/manifest.json", TestUtil.getResource("manifest.json")]]);
        const optionsClone = { ...options, configuration: { ...options.configuration } };
        delete optionsClone.configuration["sapCloudService"];
        const { resources, manifestInfo } = await BaseAppManager.process(baseAppFiles, appVariantInfo, optionsClone, abapProcessor);
        const actual = await resources[0].getBuffer().then((buffer: Buffer) => JSON.parse(buffer.toString()));
        expect(actual["sap.cloud"]).to.eql({ service: "com.sap.manifest.default.service", public: true });
        await assertAnnotations(resources, 7);
        assertManifestInfo(manifestInfo);
    });

    it("should create default 'sap.cloud'", async () => {
        const baseAppManifest = JSON.parse(TestUtil.getResource("manifest.json"));
        delete baseAppManifest["sap.cloud"];
        const baseAppFiles = new Map([["/manifest.json", JSON.stringify(baseAppManifest)]]);
        const { resources, manifestInfo } = await BaseAppManager.process(baseAppFiles, appVariantInfo, options, abapProcessor);
        const actual = await resources[0].getBuffer().then((buffer: Buffer) => JSON.parse(buffer.toString()));
        expect(actual["sap.cloud"]).to.be.undefined;
        await assertAnnotations(resources, 7);
        assertManifestInfo(manifestInfo);
    });

    it("should fill change layer", async () => {
        const baseAppFiles = new Map([["manifest.json", TestUtil.getResource("manifest.json")]]);
        const stub = sandbox.stub(Applier, "applyChanges")!;
        await BaseAppManager.process(baseAppFiles, appVariantInfo, options, abapProcessor);
        const layers = stub.getCall(0).args[1].map((change: typeof Change) => change.getLayer());
        expect(layers.every((layer: string) => layer === "CUSTOMER_BASE")).to.be.true;
    });

    it("shouldn't fill change layer if layer is undefined", async () => {
        const baseAppFiles = new Map([["manifest.json", TestUtil.getResource("manifest.json")]]);
        const stub = sandbox.stub(Applier, "applyChanges");
        const appVariantInfo = await TestUtil.getAppVariantInfo("appVariant1", options.projectNamespace);
        delete appVariantInfo.manifest["layer"];
        await BaseAppManager.process(baseAppFiles, appVariantInfo, options, abapProcessor);
        const definitionKeys = stub.getCall(0).args[1].map((change: typeof Change) => Object.keys(change._oDefinition));
        expect(definitionKeys.every((key: string[]) => !key.includes("layer"))).to.be.true;
    });

    const assertValidation = async (appVariantInfo: IAppVariantInfo, options: IProjectOptions, expectedError: string, manifest: any) => {
        try {
            await BaseAppManager.process(new Map([["/manifest.json", JSON.stringify(manifest)]]), appVariantInfo, options, abapProcessor);
            assert.fail(true, false, "Exception not thrown");
        } catch (error: any) {
            expect(error.message).to.equal(expectedError);
        }
    }

});


function assertManifestInfo(manifestInfo: IManifestInfo) {
    expect(manifestInfo.id).to.eql("customer.com.sap.application.variant.id");
    expect(manifestInfo.version).to.eql("1.0.0");
}

async function assertAnnotations(resources: any[], resourceCountExpected: number) {
    const annotationName1Expected = TestUtil.getResourceXml("annotationName1-expected.xml");
    const annotationName2Expected = TestUtil.getResourceXml("annotationName2-expected.xml");
    const name1i18nDf = await TestUtil.getResourceByName(resources, "i18n/annotations/customercomsapapplicationvariantid/i18n.properties");
    const name1i18nEn = await TestUtil.getResourceByName(resources, "i18n/annotations/customercomsapapplicationvariantid/i18n_en.properties");
    const name1i18nDe = await TestUtil.getResourceByName(resources, "i18n/annotations/customercomsapapplicationvariantid/i18n_de.properties");
    const name1i18nFr = await TestUtil.getResourceByName(resources, "i18n/annotations/customercomsapapplicationvariantid/i18n_fr.properties");
    const annotationName1Actual = await TestUtil.getResourceByName(resources, "annotations/annotation_annotationName1.xml");
    const annotationName2Actual = await TestUtil.getResourceByName(resources, "annotations/annotation_annotationName2.xml");
    expect(resources.length).to.eql(resourceCountExpected);
    expect(name1i18nDf.split("\n")).to.have.members([
        "customer.com.sap.application.variant.id_CALCULATETOTALPRICE=calculateTotalPrice",
        "customer.com.sap.application.variant.id_AIRLINE=Airline",
        "customer.com.sap.application.variant.id_AIRLINE0=Airline",
        "customer.com.sap.application.variant.id_CUSTOMER=Customer",
        "customer.com.sap.application.variant.id_CUSTOMER_VALUE_1=Customer Value 1",
        "customer.com.sap.application.variant.id_METADATA=Metadata",
        "customer.com.sap.application.variant.id_CDS_M2_SD_TRAVEL_MDUU=cds_m2_sd_travel_mduu"
    ]);
    expect(name1i18nEn.split("\n")).to.have.members([
        "customer.com.sap.application.variant.id_CALCULATETOTALPRICE=calculateTotalPrice",
        "customer.com.sap.application.variant.id_AIRLINE=Airline",
        "customer.com.sap.application.variant.id_AIRLINE0=Airline",
        "customer.com.sap.application.variant.id_CUSTOMER=Customer",
        "customer.com.sap.application.variant.id_CUSTOMER_VALUE_1=Customer Value 1",
        "customer.com.sap.application.variant.id_METADATA=Metadata",
        "customer.com.sap.application.variant.id_CDS_M2_SD_TRAVEL_MDUU=cds_m2_sd_travel_mduu"
    ]);
    expect(name1i18nDe.split("\n")).to.have.members([
        "customer.com.sap.application.variant.id_CALCULATETOTALPRICE=calculateTotalPrice",
        "customer.com.sap.application.variant.id_AIRLINE=Fluglinie",
        "customer.com.sap.application.variant.id_AIRLINE0=Fluglinie",
        "customer.com.sap.application.variant.id_CUSTOMER=Kunde",
        "customer.com.sap.application.variant.id_CUSTOMER_VALUE_1=KundeWert",
        "customer.com.sap.application.variant.id_METADATA=Metadaten",
        "customer.com.sap.application.variant.id_CDS_M2_SD_TRAVEL_MDUU=cds_m2_sd_reise_mduu"
    ]);
    expect(name1i18nFr.split("\n")).to.have.members([
        "customer.com.sap.application.variant.id_CALCULATETOTALPRICE=calculer le prix total",
        "customer.com.sap.application.variant.id_AIRLINE=Compagnie aérienne",
        "customer.com.sap.application.variant.id_AIRLINE0=Compagnie aérienne",
        "customer.com.sap.application.variant.id_CUSTOMER=Client",
        "customer.com.sap.application.variant.id_CUSTOMER_VALUE_1=Client valeur",
        "customer.com.sap.application.variant.id_METADATA=Metadonnees",
        "customer.com.sap.application.variant.id_CDS_M2_SD_TRAVEL_MDUU=cds_m2_sd_voyager_mduu"
    ]);
    expect(annotationName1Actual).to.be.eql(annotationName1Expected);
    expect(annotationName2Actual).to.be.eql(annotationName2Expected);
}
