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
                ["manifest.json", TestUtil.getResource("manifest.json")],
                ["i18n/i18n.properties", "base=a"],
                ["i18n/i18n_de.properties", "base=a_de"],
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
            "changes/id_1696839317667_propertyChange.change",
            "changes/id_1707741869990_200_flVariant.ctrl_variant",
            "changes/id_1707749484507_210_setTitle.ctrl_variant_change",
            "changes/id_1707749484509_240_setDefault.ctrl_variant_management_change",
            "changes/id_1707749484510_240_setDefault.ctrl_variant_management_change",
            "changes/id_1753705046493_197_codeExt.change",
            "changes/customer_com_sap_application_variant_id/notsupported.testfile",
            "xs-app.json"
        ]);
        // It has replaced id_12345 of appVariant1 with the appVariant2
        expect(files.get("changes/customer_com_sap_application_variant_id/coding/id_12345.js")).to.include("appVariant1");
        expect(files.get("changes/customer_app_variant_2_id/coding/id_12345.js")).to.include("appVariant2");
    });

    it("should merge i18n files of original app, appVariant1 and appVariant2", async () => {
        expect(files.get("i18n/i18n.properties")!.split("\n")).to.include.members([
            "base=a", // was in original app
            "opensap.manage.products_sap.app.title=Manage Cargo", // merged from appVariant1
            "app.variant.2=a" // merged from appVariant2
        ]);
        expect(files.get("i18n/i18n_de.properties")!.split("\n")).to.include.members([
            "base=a_de", // was in original app
            "customer.com.sap.application.variant.id.title=UI5 Task Adaptation DE", // merged from appVariant1
            "app.variant.2=a_de" // merged from appVariant2
        ]);
    });
});
