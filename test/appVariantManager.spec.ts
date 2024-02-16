import * as chai from "chai";
import * as sinon from "sinon";

import { IAppVariantInfo, IAppVariantManifest } from "../src/model/types";

import AppVariantManager from "../src/appVariantManager";
import ResourceUtil from "../src/util/resourceUtil";
import { SinonSandbox } from "sinon";
import TestUtil from "./testUtilities/testUtil";

const { byIsOmited } = TestUtil;

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
    });

    describe("when process appvariant resources", () => {

        let appVariantInfo: IAppVariantInfo;
        const changes = TestUtil.getResourceJson("appVariant1-renamed/webapp/changes/manifest/id_1696839317668_changeInbound.change");

        before(async () => {
            appVariantResources = await AppVariantManager.getAppVariantResourcesToProcess(workspace);
            appVariantInfo = await AppVariantManager.process(appVariantResources, NAMESPACE, taskUtil);
        });

        it("should get appVariant info and adjsted manifest", () => {
            expect(appVariantInfo).to.eql({
                id: "customer.com.sap.application.variant.id",
                reference: "com.sap.base.app.id",
                layer: "CUSTOMER_BASE",
                changes: [changes].concat(manifest.content)
            });
        });

        it("should include also other changes", () => {
            const filtered = appVariantResources.filter(byIsOmited(taskUtil));
            expect(filtered.map(resource => resource.getPath())).to.have.members([
                "/resources/ns/changes/fragments/AdlChart.fragment.xml",
                //"/resources/ns/changes/manifest/id_1696839317668_changeInbound.change", => Merged and no longer needed
                "/resources/ns/i18n/i18n_de.properties",
                "/resources/ns/i18n/i18n.properties",
                "/resources/ns/changes/id_1696839317667_propertyChange.change", // Will be bundled and omitted later
                //"/resources/ns/manifest.appdescr_variant", => Omitted
                "/resources/ns/changes/coding/id_12345.js",
                "/resources/ns/changes/id_1707741869990_200_flVariant.ctrl_variant",
                "/resources/ns/changes/id_1707749484507_210_setTitle.ctrl_variant_change",
                "/resources/ns/changes/id_1707749484509_240_setDefault.ctrl_variant_management_change",
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
            appVariantResources = await AppVariantManager.getAppVariantResourcesToProcess(workspace);
            await AppVariantManager.process(appVariantResources, "ns", taskUtil);
        });

        it("should adjust .properties path", () => {
            // TODO Get all workspace files and do not prefilter
            const filtered = appVariantResources.filter(byIsOmited(taskUtil));
            expect(filtered.map(resource => resource.getPath())).to.have.members([
                // "/resources/ns/manifest.appdescr_variant", => Omitted
                "/resources/ns/i18n/i18n.properties",
                "/resources/ns/i18n/i18n_de.properties",
                //"/resources/ns/changes/manifest/id_1696839317668_changeInbound.change", => Merged and no longer needed
                "/resources/ns/changes/id_1696839317667_propertyChange.change", // Will be bundled and omitted later
                "/resources/ns/changes/fragments/AdlChart.fragment.xml",
                "/resources/ns/changes/coding/id_12345.js",
                "/resources/ns/changes/id_1707741869990_200_flVariant.ctrl_variant",
                "/resources/ns/changes/id_1707749484507_210_setTitle.ctrl_variant_change",
                "/resources/ns/changes/id_1707749484509_240_setDefault.ctrl_variant_management_change",
            ]);
        });

        // subfolder changes are renamed
        it("should rename changes/manifest", async () => await assertRename(appVariantResources, "manifest/id_1696839317668_changeInbound.change", "appVariant1-renamed/webapp"));
        it("should rename changes/coding", async () => await assertRename(appVariantResources, "coding/id_12345.js", "appVariant1-renamed/webapp"));
        it("should rename changes/fragments", async () => await assertRename(appVariantResources, "fragments/AdlChart.fragment.xml", "appVariant1-renamed/webapp"));
        // root folder changes are renamed
        it("should rename .change in changes root folder", async () => await assertRename(appVariantResources, "id_1696839317667_propertyChange.change", "appVariant1-renamed/webapp"));
        it("should rename .ctrl_variant in changes root folder", async () => await assertRename(appVariantResources, "id_1707741869990_200_flVariant.ctrl_variant", "appVariant1-renamed/webapp"));
        it("should rename .ctrl_variant_change in changes root folder", async () => await assertRename(appVariantResources, "id_1707749484507_210_setTitle.ctrl_variant_change", "appVariant1-renamed/webapp"));
        it("should rename .ctrl_variant_management_change in changes root folder", async () => await assertRename(appVariantResources, "id_1707749484509_240_setDefault.ctrl_variant_management_change", "appVariant1-renamed/webapp"));
        it("should not rename .testfile in changes root folder", async () => {
            const resources: any[] = (await workspace.byGlob("/**/*")).filter(byIsOmited(taskUtil));
            await assertRename(resources, "notsupported.testfile", "appVariant1-renamed/webapp")
        });
        
    });

    describe("when having change with url", () => {
        it("should adjust url when url to local file", async () => {
            await assertChangeUrl("../annotations/annotation_1707246076536.xml", "changes/annotations/annotation_1707246076536.xml");
        });
        it("shouldn't adjust url when url to service", async () => {
            await assertChangeUrl("/sap/opu/odata4/f4_sd_airlines_mduu/", "/sap/opu/odata4/f4_sd_airlines_mduu/");
        });
        it("should adjust url when url to local file", async () => {
            await assertChangeUrl("../annotation_1707246076536.xml", "changes/annotation_1707246076536.xml");
        });
    });

    async function assertChangeUrl(testUrl: string, expectedUrl: string) {
        const changeResource = ResourceUtil.createResource(
            "changes/manifest/id_1707246076536_addAnnotationsToOData.change",
            NAMESPACE, JSON.stringify({
                "changeType": "appdescr_app_addAnnotationsToOData",
                "content": {
                    "dataSource": {
                        "customer.annotation.annotation_1707246076536": {
                            "uri": testUrl,
                            "type": "ODataAnnotation"
                        }
                    }
                }
            })
        );
        const manifestResource = ResourceUtil.createResource(
            "manifest.appdescr_variant",
            NAMESPACE, JSON.stringify({
                "reference": "base.app.id",
                "id": "customer.base.app.id.variant1",
                "content": []
            })
        );
        const resources = [changeResource, manifestResource];
        const appVariantInfo = await AppVariantManager.process(resources, NAMESPACE, taskUtil);
        const manifest = JSON.parse(await TestUtil.getResourceByName(resources,
            "id_1707246076536_addAnnotationsToOData.change"));
        expect(manifest.content.dataSource["customer.annotation.annotation_1707246076536"].uri)
            .to.eq(expectedUrl);
        expect((appVariantInfo.changes[0].content! as any).dataSource["customer.annotation.annotation_1707246076536"].uri)
            .to.eq(expectedUrl);
    }

});


async function assertRename(clones: any[], filename: string, testResourcesFolder = "appVariant1/webapp") {
    const changeInboundChange = await TestUtil.getResourceByName(clones, `/resources/ns/changes/${filename}`);
    expect(changeInboundChange).to.eql(TestUtil.getResource(`${testResourcesFolder}/changes/${filename}`));
}

function getOmitFlag(resources: any[], taskUtil: any, endsWith: string) {
    const resource = resources.find(resource => resource.getPath().endsWith(endsWith));
    return taskUtil.getTag(resource, taskUtil.STANDARD_TAGS.OmitFromBuildResult);
}