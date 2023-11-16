import * as chai from "chai";
import * as sinon from "sinon";

import { IAppVariantInfo, IAppVariantManifest, IChange } from "../src/model/types";

import AppVariantManager from "../src/appVariantManager";
import { SinonSandbox } from "sinon";
import TestUtil from "./util/testUtil";

const { expect } = chai;

describe("AppVariantManager", () => {
    let sandbox: SinonSandbox;
    let appVariantResources: any[];
    let taskUtil: any;
    let manifest: IAppVariantManifest;
    let workspace: any;

    const NAMESPACE = "ns";

    beforeEach(async () => sandbox = sinon.createSandbox());
    afterEach(() => sandbox.restore());

    before(async () => {
        const projectMeta = await TestUtil.getWorkspace("appVariant1", NAMESPACE);
        workspace = projectMeta.workspace;
        taskUtil = projectMeta.taskUtil;
        manifest = JSON.parse(TestUtil.getResource("appVariant1/webapp/manifest.appdescr_variant"));
        manifest.content.filter((change: IChange) => change.changeType === "appdescr_ui5_addNewModelEnhanceWith").forEach((change: IChange) => {
            change.texts.i18n = "customer_com_sap_application_variant_id/" + change.texts.i18n;
        });
    });

    describe("when process appvariant resources", () => {

        let appVariantInfo: IAppVariantInfo;
        const manifestChanges = TestUtil.getResourceJson("appVariant1/webapp/changes/manifest/id_1696839317668_changeInbound.change");

        before(async () => {
            appVariantResources = await AppVariantManager.getAppVariantResources(workspace);
            appVariantInfo = await AppVariantManager.process(appVariantResources, NAMESPACE, taskUtil);
        });

        it("should get appVariant info and adjsted manifest", () => {
            expect(appVariantInfo).to.eql({
                id: "customer.com.sap.application.variant.id",
                reference: "com.sap.base.app.id",
                manifest,
                manifestChanges: [manifestChanges]
            });
        });

        it("should adjust .properties path", () => {
            expect(appVariantResources.some(resource =>
                resource.getPath() === "/resources/ns/customer_com_sap_application_variant_id/i18n/i18n.properties")).to.be.true;
        });

        it("should include also other changes", () => {
            expect(appVariantResources.map(resource => resource.getPath())).to.have.members([
                "/resources/ns/manifest.appdescr_variant", // we don't adjust the path since we omit it anyway
                "/resources/ns/customer_com_sap_application_variant_id/i18n/i18n.properties",
                "/resources/ns/changes/fragments/AdlChart.fragment.xml",
                "/resources/ns/changes/id_1696839317667_propertyChange.change",
                "/resources/ns/changes/coding/id_12345.js",
                "/resources/ns/changes/manifest/id_1696839317668_changeInbound.change"
            ]);
        });

        describe("when omitting appVariant files", () => {
            it("should omit manifest.appdescr_variant", () => {
                expect(getOmitFlag(appVariantResources, taskUtil, "manifest.appdescr_variant")).to.be.true;
            });
            it("should omit changes/manifest files", () => {
                expect(getOmitFlag(appVariantResources, taskUtil, "manifest/id_1696839317668_changeInbound.change")).to.be.true;
            });
            it("should not omit i18n*.properties files", () => {
                expect(getOmitFlag(appVariantResources, taskUtil, "i18n.properties")).to.be.undefined;
            });
        })

    });

    describe("when process appvariant resources with resources path", () => {

        before(async () => {
            appVariantResources = await AppVariantManager.getAppVariantResources(workspace);
            await AppVariantManager.process(appVariantResources, "ns", taskUtil);
        });

        it("should adjust .properties path", () => {
            expect(appVariantResources.map(resource => resource.getPath())).to.have.members([
                "/resources/ns/manifest.appdescr_variant", // we don't adjust the path since we omit it anyway
                "/resources/ns/customer_com_sap_application_variant_id/i18n/i18n.properties",
                "/resources/ns/changes/manifest/id_1696839317668_changeInbound.change",
                "/resources/ns/changes/id_1696839317667_propertyChange.change",
                "/resources/ns/changes/fragments/AdlChart.fragment.xml",
                "/resources/ns/changes/coding/id_12345.js"
            ]);
        });

        it("shouldn't rename changes/manifest", async () => await assertRename(appVariantResources, "manifest/id_1696839317668_changeInbound.change"));
        it("shouldn't rename changes/coding", async () => await assertRename(appVariantResources, "coding/id_12345.js"));
        it("shouldn't rename changes/fragments", async () => await assertRename(appVariantResources, "fragments/AdlChart.fragment.xml"));
        it("should rename in changes root folder", async () => await assertRename(appVariantResources, "id_1696839317667_propertyChange.change", "appVariant1-renamed/webapp"));

    });

});

async function assertRename(clones: any[], filename: string, testResourcesFolder = "appVariant1/webapp") {
    const changeInboundChange = await TestUtil.getResourceByName(clones, `/resources/ns/changes/${filename}`);
    expect(changeInboundChange).to.eql(TestUtil.getResource(`${testResourcesFolder}/changes/${filename}`));
}

function getOmitFlag(resources: any[], taskUtil: any, endsWith: string) {
    const resource = resources.find(resource => resource.getPath().endsWith(endsWith));
    return taskUtil.getTag(resource, taskUtil.STANDARD_TAGS.OmitFromBuildResult);
}