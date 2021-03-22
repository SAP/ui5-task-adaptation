import * as chai from "chai";
import * as path from "path";
import * as sinon from "sinon";

import { IAppVariantInfo, IAppVariantManifest, IChange } from "../src/model/types";

import AppVariantManager from "../src/appVariantManager";
import { SinonSandbox } from "sinon";
import TestUtil from "./util/testUtil";
const Resource = require("@ui5/fs/lib/Resource");
const { expect } = chai;

describe("AppVariantManager", () => {
    let sandbox: SinonSandbox;
    let appVariantResources: any[];
    let taskUtil: any;
    let manifest: IAppVariantManifest;
    let workspace: any;

    beforeEach(async () => sandbox = sinon.createSandbox());
    afterEach(() => sandbox.restore());

    before(async () => {
        const projectMeta = await TestUtil.getWorkspace("appVariant1");
        workspace = projectMeta.workspace;
        taskUtil = projectMeta.taskUtil;
        manifest = JSON.parse(TestUtil.getResource("appVariant1/webapp/manifest.appdescr_variant"));
        manifest.content.filter((change: IChange) => change.changeType === "appdescr_ui5_addNewModelEnhanceWith").forEach((change: IChange) => {
            change.texts.i18n = "customer_com_sap_application_variant_id/" + change.texts.i18n;
        });
    });

    describe("when process appvariant resources", () => {

        let appVariantInfo: IAppVariantInfo;

        before(async () => {
            appVariantResources = await AppVariantManager.getAppVariantResources(workspace);
            appVariantInfo = await AppVariantManager.process(appVariantResources, "ns", taskUtil);
        });

        it("should get appVariant info and adjsted manifest", () => {
            expect(appVariantInfo).to.eql({
                id: "customer.com.sap.application.variant.id",
                reference: "com.sap.base.app.id",
                manifest
            });
        });

        it("should adjust .properties path", () => {
            expect(appVariantResources.map(resource => resource.getPath())).to.have.members([
                "/manifest.appdescr_variant", // we don't adjust the path since we omit it anyway
                "/customer_com_sap_application_variant_id/i18n/i18n.properties"
            ]);
        });

        it("should omit manifest.appdescr_variant", () => {
            const manifestActual = appVariantResources.find(resource => resource.getPath().endsWith("manifest.appdescr_variant"));
            const i18nActual = appVariantResources.find(resource => resource.getPath().endsWith("i18n.properties"));
            expect(taskUtil.getTag(manifestActual, taskUtil.STANDARD_TAGS.OmitFromBuildResult)).to.be.true;
            expect(taskUtil.getTag(i18nActual, taskUtil.STANDARD_TAGS.OmitFromBuildResult)).to.be.undefined;
        });

    });

    describe("when process appvariant resources with resources path", () => {
        let clones: any[]

        before(async () => {
            appVariantResources = await AppVariantManager.getAppVariantResources(workspace);
            clones = await Promise.all(appVariantResources.map(resource => clone(resource, "ns")));
            await AppVariantManager.process(clones, "ns", taskUtil);
        });

        it("should adjust .properties path", () => {
            expect(clones.map(resource => resource.getPath())).to.have.members([
                "/resources/ns/manifest.appdescr_variant", // we don't adjust the path since we omit it anyway
                "/resources/ns/customer_com_sap_application_variant_id/i18n/i18n.properties"
            ]);
        });
    });

});

async function clone(resource: any, namespace: string) {
    const clone = { ...resource };
    clone.path = path.join("/resources", namespace, clone._path);
    clone.string = await resource.getString();
    return new Resource(clone);
}