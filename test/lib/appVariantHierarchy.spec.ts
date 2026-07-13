import AbapRepository from "../../src/repositories/abapRepository.js";
import CacheHolder from "../../src/cache/cacheHolder.js";
import { IProjectOptions } from "../../src/model/types.js";
import ResourceUtil from "../../src/util/resourceUtil.js";
import TestUtil from "./testUtilities/testUtil.js";
import XmlUtil from "../../src/util/xmlUtil.js";
import esmock from "esmock";
import { expect } from "chai";
import sinon from "sinon";
import AbapAnnotationManager from "../../src/annotations/abapAnnotationManager.js";
import AbapAdapter from "../../src/adapters/abapAdapter.js";

describe("App Variant Hierarchy", () => {
    let sandbox: sinon.SinonSandbox;
    const options: IProjectOptions = {
        projectNamespace: "ns",
        configuration: {
            target: {
                url: "https://example.sap.com"
            }
        }
    };

    after(() => CacheHolder.clear());
    afterEach(() => sandbox.restore());

    let files = new Map<string, string>();
    beforeEach(async () => {
        sandbox = sinon.createSandbox();
        sandbox.stub(AbapAnnotationManager.prototype, "process").resolves(new Map<string, string>());
        sandbox.stub(AbapRepository.prototype, "getAppVariantIdHierarchy").resolves([
            {
                appName: "REPO_NAME_1",
                cacheBusterToken: Promise.resolve("cachebusterToken1")
            },
            {
                appName: "REPO_NAME_0",
                cacheBusterToken: Promise.resolve("cachebusterToken0")
            }
        ]);
        const appVariant1Path = TestUtil.getResourcePath("appVariant1", "webapp");
        sandbox.stub(AbapRepository.prototype, "fetch")
            .withArgs(sinon.match({ appName: "REPO_NAME_0" })).resolves(new Map([
                ["manifest.json", Buffer.from(TestUtil.getResource("manifest.json"))],
                ["i18n/i18n.properties", Buffer.from("base=a")],
                ["i18n/i18n_de.properties", Buffer.from("base=a_de")],
            ]))
            .withArgs(sinon.match({ appName: "REPO_NAME_1" })).resolves(await ResourceUtil.byGlob(appVariant1Path, "**/*"));
        const repository = new AbapRepository(options.configuration);
        const annotationManager = new AbapAnnotationManager(options.configuration, repository);
        const index = await esmock("../../src/index.js", {}, {
            "../../src/landscapeConfiguration.js": {
                initialize: () => ({
                    repository,
                    adapter: new AbapAdapter(annotationManager)
                })
            }
        });

        const { workspace, taskUtil } = await TestUtil.getWorkspace("appVariant2", options.projectNamespace);
        await index({ workspace, options, taskUtil });
        const resources: any[] = (await workspace.byGlob("/**/*")).filter(TestUtil.byIsOmited(taskUtil));
        files = await ResourceUtil.toFileMap(resources, options.projectNamespace);
    });

    it("should rename id to one of appVariant2", () => {
        const { id } = JSON.parse(files.get("manifest.json")!)["sap.app"];
        expect(id).to.eql("customer.app.variant.2.id"); // id of the appVariant2
    });

    it("should have inbouds of original app, appVariant1 and appVariant2", () => {
        const { crossNavigation } = JSON.parse(files.get("manifest.json")!)["sap.app"];
        expect(Object.keys(crossNavigation.inbounds)).to.have.members([
            "manifest-configure", // was in original app
            "customer.contactCreate", // created by appVariant1
            "customer.app.variant.2.inbound" // created by appVariant2
        ]);
    });

    it("should contain fragment renamed to appVariant2", () => {
        const fragment = XmlUtil.xmlToJson(files.get("changes/customer_com_sap_application_variant_id/fragments/AdlChart.fragment.xml")!);
        expect(fragment.Popover.content["viz:VizFrame"]._attributes.appId).eql("customer.app.variant.2.id");
        expect(fragment.Popover.content["viz:VizFrame"]._attributes.appIdSlashes).eql("customer/app/variant/2/id");
    });

    it("should contain control change renamed to appVariant2", () => {
        const change = JSON.parse(files.get("changes/id_1707749484509_240_setDefault.ctrl_variant_management_change")!);
        expect(change.reference).eql("customer.app.variant.2.id");
        expect(change.selector.id).eql("customer.app.variant.2.id::FreightCostAllocationDocumentList--fe::PageVariantManagement");
        expect(change.namespace).eql("apps/customer.app.variant.2.id/changes/");
    });

    it("should contain control change from appVariant2", () => {
        const change = JSON.parse(files.get("changes/id_1707749484510_240_setDefault.ctrl_variant_management_change")!);
        expect(change.reference).eql("customer.app.variant.2.id");
        expect(change.selector.id).eql("customer.app.variant.2.id::FreightCostAllocationDocumentList--fe::PageVariantManagement");
        expect(change.namespace).eql("apps/customer.app.variant.2.id/changes/");
    });

    it("should contains files of original app, appVariant1 and appVariant2", () => {
        expect([...files.keys()].toSorted()).to.have.members([
            "i18n/i18n_de.properties",
            "i18n/i18n.properties",
            "manifest.json",
            "changes/customer_app_variant_2_id/coding/id_12345.js",
            "changes/customer_app_variant_2_id/fragments/AdlChart.fragment.xml",
            "changes/customer_com_sap_application_variant_id/coding/id_12345.js",
            "changes/customer_com_sap_application_variant_id/fragments/AdlChart.fragment.xml",
            "changes/customer_com_sap_application_variant_id/notsupported.testfile",
            "changes/id_1696839317667_propertyChange.change",
            "changes/id_1707741869990_200_flVariant.ctrl_variant",
            "changes/id_1707749484507_210_setTitle.ctrl_variant_change",
            "changes/id_1707749484509_240_setDefault.ctrl_variant_management_change",
            "changes/id_1707749484510_240_setDefault.ctrl_variant_management_change",
            "changes/id_1753705046493_197_codeExt.change",
            "xs-app.json"
        ]);
        // It has replaced id_12345 of appVariant1 with the appVariant2
        expect(files.get("changes/customer_com_sap_application_variant_id/coding/id_12345.js")!.toString()).to.include("appVariant1");
        expect(files.get("changes/customer_app_variant_2_id/coding/id_12345.js")!.toString()).to.include("appVariant2");
    });

    it("should merge i18n files of original app, appVariant1 and appVariant2", async () => {
        expect(files.get("i18n/i18n.properties")!.toString().split("\n")).to.include.members([
            "base=a", // was in original app
            "opensap.manage.products_sap.app.title=Manage Cargo", // merged from appVariant1
            "app.variant.2=a" // merged from appVariant2
        ]);
        expect(files.get("i18n/i18n_de.properties")!.toString().split("\n")).to.include.members([
            "base=a_de", // was in original app
            "customer.com.sap.application.variant.id.title=UI5 Task Adaptation DE", // merged from appVariant1
            "app.variant.2=a_de" // merged from appVariant2
        ]);
    });
});


describe("OData DataSource Hierarchy", () => {
    let sandbox: sinon.SinonSandbox;
    const options: IProjectOptions = {
        projectNamespace: "ns",
        configuration: {
            target: {
                url: "https://example.sap.com"
            },
            languages: ["EN"]
        }
    };

    const METADATA_XML = `<?xml version="1.0" encoding="utf-8"?>
<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx" xmlns="http://docs.oasis-open.org/odata/ns/edm">
    <edmx:Reference Uri="/sap/opu/odata/IWFND/CATALOGSERVICE;v=2/Vocabularies('com.sap.vocabularies.Common.v1')/$value">
        <edmx:Include Namespace="com.sap.vocabularies.Common.v1" Alias="Common"/>
    </edmx:Reference>
    <edmx:DataServices>
        <Schema Namespace="com.sap.self" Alias="SAP__self"/>
    </edmx:DataServices>
</edmx:Edmx>`;

    const BASE_MANIFEST = JSON.stringify({
        "_version": "1.12.0",
        "sap.app": {
            "id": "com.sap.base.app",
            "type": "application",
            "applicationVersion": { "version": "1.0.0" },
            "dataSources": {}
        }
    });

    function createAppVariantManifest(reference: string, id: string, serviceNum: number): string {
        return JSON.stringify({
            "fileName": "manifest",
            "layer": "CUSTOMER_BASE",
            "fileType": "appdescr_variant",
            "reference": reference,
            "id": id,
            "namespace": `apps/${reference}/appVariants/${id}/`,
            "content": [{
                "changeType": "appdescr_app_addNewDataSource",
                "content": {
                    "dataSource": {
                        [`customer.odata.service${serviceNum}`]: {
                            "uri": `/sap/opu/odata/sap/service${serviceNum}/`,
                            "type": "OData",
                            "settings": {
                                "annotations": [`customer.annotation.service${serviceNum}`]
                            }
                        },
                        [`customer.annotation.service${serviceNum}`]: {
                            "uri": `/sap/annotation/service${serviceNum}`,
                            "type": "ODataAnnotation"
                        }
                    }
                }
            }]
        });
    }

    after(() => CacheHolder.clear());
    afterEach(() => sandbox.restore());

    let files = new Map<string, string>();
    let downloadAnnotationFileStub: sinon.SinonStub;
    beforeEach(async () => {
        sandbox = sinon.createSandbox();
        downloadAnnotationFileStub = sandbox.stub(AbapRepository.prototype, "downloadAnnotationFile")
            .resolves(new Map([["metadata.xml", METADATA_XML]]));
        sandbox.stub(AbapRepository.prototype, "getAppVariantIdHierarchy").resolves([
            { appName: "REPO_3", cacheBusterToken: Promise.resolve("token3") },
            { appName: "REPO_2", cacheBusterToken: Promise.resolve("token2") },
            { appName: "REPO_1", cacheBusterToken: Promise.resolve("token1") },
            { appName: "REPO_0", cacheBusterToken: Promise.resolve("token0") },
        ]);
        sandbox.stub(AbapRepository.prototype, "fetch")
            .withArgs(sinon.match({ appName: "REPO_0" })).resolves(new Map([
                ["manifest.json", BASE_MANIFEST],
            ]))
            .withArgs(sinon.match({ appName: "REPO_1" })).resolves(new Map([
                ["manifest.appdescr_variant", createAppVariantManifest("com.sap.base.app", "customer.variant.one", 1)],
            ]))
            .withArgs(sinon.match({ appName: "REPO_2" })).resolves(new Map([
                ["manifest.appdescr_variant", createAppVariantManifest("customer.variant.one", "customer.variant.two", 2)],
            ]))
            .withArgs(sinon.match({ appName: "REPO_3" })).resolves(new Map([
                ["manifest.appdescr_variant", createAppVariantManifest("customer.variant.two", "customer.variant.three", 3)],
            ]));

        const repository = new AbapRepository(options.configuration);
        const annotationManager = new AbapAnnotationManager(options.configuration, repository);
        const index = await esmock("../../src/index.js", {}, {
            "../../src/landscapeConfiguration.js": {
                initialize: () => ({
                    repository,
                    adapter: new AbapAdapter(annotationManager)
                })
            }
        });

        const { workspace, taskUtil } = await TestUtil.getWorkspace("appVariantOData", options.projectNamespace);
        await index({ workspace, options, taskUtil });
        const resources: any[] = (await workspace.byGlob("/**/*")).filter(TestUtil.byIsOmited(taskUtil));
        files = await ResourceUtil.toFileMap(resources, options.projectNamespace);
    });

    it("should have all OData dataSources from 3 appVariants", () => {
        const { dataSources } = JSON.parse(files.get("manifest.json")!)["sap.app"];
        for (const num of [1, 2, 3]) {
            expect(dataSources[`customer.odata.service${num}`]).to.deep.include({
                uri: `/sap/opu/odata/sap/service${num}/`,
                type: "OData",
            });
            expect(dataSources[`customer.odata.service${num}`].settings.annotations)
                .to.include(`customer.annotation.service${num}`);
        }
    });

    it("should have all ODataAnnotation dataSources from 3 appVariants", () => {
        const { dataSources } = JSON.parse(files.get("manifest.json")!)["sap.app"];
        for (const num of [1, 2, 3]) {
            const annotation = dataSources[`customer.annotation.service${num}`];
            expect(annotation.type).to.eql("ODataAnnotation");
            expect(annotation.uri).to.eql(`annotations/annotation_customer.annotation.service${num}.xml`);
        }
    });

    it("should set ignoreAnnotationsFromMetadata on each OData dataSource", () => {
        const { dataSources } = JSON.parse(files.get("manifest.json")!)["sap.app"];
        for (const num of [1, 2, 3]) {
            expect(dataSources[`customer.odata.service${num}`].settings.ignoreAnnotationsFromMetadata).to.eql(true);
        }
    });

    it("should download annotations for each OData service exactly once", () => {
        const downloadedUrls = downloadAnnotationFileStub.getCalls().map((call: any) => call.args[0]);
        for (const num of [1, 2, 3]) {
            const matchingCalls = downloadedUrls.filter((url: string) => url.includes(`service${num}`));
            expect(matchingCalls).to.have.lengthOf(2, `service${num} should be downloaded once for OData and once for ODataAnnotation`);
        }
    });

    it("should set id to the adaptation project id", () => {
        const { id } = JSON.parse(files.get("manifest.json")!)["sap.app"];
        expect(id).to.eql("customer.variant.adaptation");
    });
});
