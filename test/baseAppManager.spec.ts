import * as chai from "chai";
import * as sinon from "sinon";

import { IAppVariantInfo, IProjectOptions } from "../src/model/types";

import AbapProcessor from "../src/processors/abapProcessor";
import AbapRepoManager from "../src/repositories/abapRepoManager";
import AnnotationManager from "../src/annotationManager";
import BaseAppFilesCacheManager from "../src/cache/baseAppFilesCacheManager";
import BaseAppManager from "../src/baseAppManager";
import CFProcessor from "../src/processors/cfProcessor"
import MockServer from "./util/mockServer";
import { SinonSandbox } from "sinon";
import TestUtil from "./util/testUtil";

const { Applier, Change } = require("../dist/bundle");

const { expect, assert } = chai;

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
        appVariantInfo = await TestUtil.getAppVariantInfo("appVariant1");
    });

    it("should update base app manifest", async () => {
        const baseAppFiles = new Map([
            ["manifest.json", TestUtil.getResource("manifest.json")],
            ["component-preload.js", TestUtil.getResource("component-preload.js")]
        ]);
        const resources = await BaseAppManager.process(baseAppFiles, appVariantInfo, options, new CFProcessor(options.configuration, baseAppCacheManager));
        const actualManifest = await TestUtil.getResourceJsonByName(resources, "manifest.json");
        const actualCPreload = await TestUtil.getResourceByName(resources, "component-preload.js");
        expect(actualManifest).to.eql(JSON.parse(TestUtil.getResource("manifest-expected-cf.json")));
        expect(actualCPreload).to.eql(TestUtil.getResource("component-preload-expected.js"));
    });

    it("should skip base app files", async () => {
        const baseAppFiles = new Map([
            ["/manifest.json", TestUtil.getResource("manifest.json")],
            ["/manifest-bundle.zip", ""],
            ["/Component-preload.js", ""],
            ["/sap-ui-cachebuster-info.json", ""]
        ]);
        const resources = await BaseAppManager.process(baseAppFiles, appVariantInfo, options, new CFProcessor(options.configuration, baseAppCacheManager));
        expect(resources.map(res => res.getPath())).to.have.members(["/resources/ns/manifest.json"]);
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
        const resources = await BaseAppManager.process(baseAppFiles, appVariantInfo, optionsClone, new CFProcessor(optionsClone.configuration, baseAppCacheManager));
        const actual = await resources[0].getBuffer().then((buffer: Buffer) => JSON.parse(buffer.toString()));
        expect(actual["sap.cloud"]).to.be.undefined;
    });

    it("should create default 'sap.cloud'", async () => {
        const baseAppManifest = JSON.parse(TestUtil.getResource("manifest.json"));
        delete baseAppManifest["sap.cloud"];
        const baseAppFiles = new Map([["/manifest.json", JSON.stringify(baseAppManifest)]]);
        const resources = await BaseAppManager.process(baseAppFiles, appVariantInfo, options, new CFProcessor(options.configuration, baseAppCacheManager));
        const actual = await resources[0].getBuffer().then((buffer: Buffer) => JSON.parse(buffer.toString()));
        expect(actual["sap.cloud"]).to.eql({ service: "sapCloudService" });
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
        const appVariantInfo = await TestUtil.getAppVariantInfo("appVariant1");
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
        const appVariantInfo = await TestUtil.getAppVariantInfo("appVariant1");
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
        appVariantInfo = await TestUtil.getAppVariantInfo("appVariant1");
        sandbox = sinon.createSandbox();
        MockServer.stubAnnotations(sandbox, abapRepoManager);
    });

    it("should update base app manifest", async () => {
        const baseAppFiles = new Map([
            ["manifest.json", TestUtil.getResource("manifest.json")],
            ["component-preload.js", TestUtil.getResource("component-preload.js")]
        ]);
        const resources = await BaseAppManager.process(baseAppFiles, appVariantInfo, options, abapProcessor);
        const actualManifest = await TestUtil.getResourceJsonByName(resources, "manifest.json");
        const actualCPreload = await TestUtil.getResourceByName(resources, "component-preload.js");
        expect(actualManifest).to.eql(JSON.parse(TestUtil.getResource("manifest-expected-abap.json")));
        expect(actualCPreload).to.eql(TestUtil.getResource("component-preload-expected.js"));
        await assertAnnotations(resources, 8);
    });

    it("should skip base app files", async () => {
        const baseAppFiles = new Map([
            ["/manifest.json", TestUtil.getResource("manifest.json")],
            ["/manifest-bundle.zip", ""],
            ["/Component-preload.js", ""],
            ["/sap-ui-cachebuster-info.json", ""]
        ]);
        const resources = await BaseAppManager.process(baseAppFiles, appVariantInfo, options, abapProcessor);
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
        const resources = await BaseAppManager.process(baseAppFiles, appVariantInfo, optionsClone, abapProcessor);
        const actual = await resources[0].getBuffer().then((buffer: Buffer) => JSON.parse(buffer.toString()));
        expect(actual["sap.cloud"]).to.eql({ service: "com.sap.manifest.default.service", public: true });
        await assertAnnotations(resources, 7);
    });

    it("should create default 'sap.cloud'", async () => {
        const baseAppManifest = JSON.parse(TestUtil.getResource("manifest.json"));
        delete baseAppManifest["sap.cloud"];
        const baseAppFiles = new Map([["/manifest.json", JSON.stringify(baseAppManifest)]]);
        const resources = await BaseAppManager.process(baseAppFiles, appVariantInfo, options, abapProcessor);
        const actual = await resources[0].getBuffer().then((buffer: Buffer) => JSON.parse(buffer.toString()));
        expect(actual["sap.cloud"]).to.be.undefined;
        await assertAnnotations(resources, 7);
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
        const appVariantInfo = await TestUtil.getAppVariantInfo("appVariant1");
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
    expect(name1i18nDf).to.eql("customer.com.sap.application.variant.id_AIRLINE0=Airline\ncustomer.com.sap.application.variant.id_AIRLINE=Airline\ncustomer.com.sap.application.variant.id_CALCULATETOTALPRICE=calculateTotalPrice\ncustomer.com.sap.application.variant.id_CDS_M2_SD_TRAVEL_MDUU=cds_m2_sd_travel_mduu\ncustomer.com.sap.application.variant.id_CUSTOMER=Customer\ncustomer.com.sap.application.variant.id_CUSTOMER_VALUE_1=Customer Value 1\ncustomer.com.sap.application.variant.id_METADATA=Metadata");
    expect(name1i18nEn).to.eql("customer.com.sap.application.variant.id_AIRLINE0=Airline\ncustomer.com.sap.application.variant.id_AIRLINE=Airline\ncustomer.com.sap.application.variant.id_CALCULATETOTALPRICE=calculateTotalPrice\ncustomer.com.sap.application.variant.id_CDS_M2_SD_TRAVEL_MDUU=cds_m2_sd_travel_mduu\ncustomer.com.sap.application.variant.id_CUSTOMER=Customer\ncustomer.com.sap.application.variant.id_CUSTOMER_VALUE_1=Customer Value 1\ncustomer.com.sap.application.variant.id_METADATA=Metadata");
    expect(name1i18nDe).to.eql("customer.com.sap.application.variant.id_AIRLINE0=Fluglinie\ncustomer.com.sap.application.variant.id_AIRLINE=Fluglinie\ncustomer.com.sap.application.variant.id_CALCULATETOTALPRICE=calculateTotalPrice\ncustomer.com.sap.application.variant.id_CDS_M2_SD_TRAVEL_MDUU=cds_m2_sd_reise_mduu\ncustomer.com.sap.application.variant.id_CUSTOMER=Kunde\ncustomer.com.sap.application.variant.id_CUSTOMER_VALUE_1=KundeWert\ncustomer.com.sap.application.variant.id_METADATA=Metadaten");
    expect(name1i18nFr).to.eql("customer.com.sap.application.variant.id_AIRLINE0=Compagnie aérienne\ncustomer.com.sap.application.variant.id_AIRLINE=Compagnie aérienne\ncustomer.com.sap.application.variant.id_CALCULATETOTALPRICE=calculer le prix total\ncustomer.com.sap.application.variant.id_CDS_M2_SD_TRAVEL_MDUU=cds_m2_sd_voyager_mduu\ncustomer.com.sap.application.variant.id_CUSTOMER=Client\ncustomer.com.sap.application.variant.id_CUSTOMER_VALUE_1=Client valeur\ncustomer.com.sap.application.variant.id_METADATA=Metadonnees");
    expect(annotationName1Actual).to.be.eql(annotationName1Expected);
    expect(annotationName2Actual).to.be.eql(annotationName2Expected);
}

