import * as chai from "chai";
import * as sinon from "sinon";

import AppVariant from "../../src/appVariantManager.js";
import { IAppVariantManifest } from "../../src/model/types.js";
import { SinonSandbox } from "sinon";
import TestUtil from "./testUtilities/testUtil.js";
import FilesUtil from "../../src/util/filesUtil.js";

const { expect } = chai;

describe("AppVariantManager", () => {
    let sandbox: SinonSandbox;
    let appVariant: AppVariant;
    let manifest: IAppVariantManifest;
    let workspace: any;

    const NAMESPACE = "ns";

    beforeEach(async () => sandbox = sinon.createSandbox());
    afterEach(() => sandbox.restore());

    before(async () => {
        const projectMeta = await TestUtil.getWorkspace("appVariant1", NAMESPACE);
        workspace = projectMeta.workspace;
        manifest = JSON.parse(TestUtil.getResource("appVariant1/webapp/manifest.appdescr_variant"));
    });

    describe("when process appvariant resources", () => {

        const changes = TestUtil.getResourceJson("appVariant1-renamed/webapp/changes/id_1696839317668_changeInbound.change");
        let files: ReadonlyMap<string, string>;

        before(async () => {
            appVariant = await AppVariant.fromWorkspace(workspace, NAMESPACE);
            files = FilesUtil.filter(appVariant.files);
        });

        it("should get appVariant info and adjsted manifest", () => {
            expect(appVariant.id).to.be.eql("customer.com.sap.application.variant.id");
            expect(appVariant.reference).to.be.eql("com.sap.base.app.id");
            expect(appVariant.layer).to.be.eql("CUSTOMER_BASE");
            const expectedChanges = manifest.content.concat(changes);
            expectedChanges.forEach(change => change.layer = appVariant.layer);
            expect(appVariant.getProcessedManifestChanges()).to.be.eql(expectedChanges);
        });

        it("should include also other changes", async () => {
            const expectedMembers = [
                "changes/fragments/AdlChart.fragment.xml",
                //"changes/id_1696839317668_changeInbound.change", => Merged and no longer needed
                "i18n/i18n_de.properties",
                "i18n/i18n.properties",
                "changes/id_1696839317667_propertyChange.change", // Will be bundled and omitted later
                //"manifest.appdescr_variant", => Omitted
                "changes/coding/id_12345.js",
                "changes/id_1707741869990_200_flVariant.ctrl_variant",
                "changes/id_1707749484507_210_setTitle.ctrl_variant_change",
                "changes/id_1707749484509_240_setDefault.ctrl_variant_management_change",
                "changes/id_1753705046493_197_codeExt.change"
            ].toSorted();
            expect([...files.keys()].toSorted()).to.have.members(expectedMembers);
        });

        describe("when omitting appVariant files", () => {
            it("should omit manifest.appdescr_variant", () => {
                expect(files.has("manifest.appdescr_variant")).to.be.false;
            });
            it("should omit changes/manifest files", () => {
                expect(files.has("changes/id_1696839317668_changeInbound.change")).to.be.false;
            });
            it("should not omit i18n*.properties files", () => {
                expect(files.has("i18n/i18n.properties")).to.be.true;
            });
        })

    });

    describe("when process appvariant files", () => {

        let processedFiles: ReadonlyMap<string, string>
        before(async () => {
            appVariant = await AppVariant.fromWorkspace(workspace, NAMESPACE);
            processedFiles = FilesUtil.rename(appVariant.files, new Map([["com.sap.base.app.id", appVariant.id]]));
            processedFiles = FilesUtil.filter(processedFiles);
        });

        it("should adjust .properties path", async () => {
            // TODO Get all workspace files and do not prefilter
            expect([...processedFiles.keys()]).to.have.members([
                // "manifest.appdescr_variant", => Omitted
                "i18n/i18n.properties",
                "i18n/i18n_de.properties",
                //"changes/id_1696839317668_changeInbound.change", => Merged and no longer needed
                "changes/id_1696839317667_propertyChange.change", // Will be bundled and omitted later
                "changes/id_1753705046493_197_codeExt.change",
                "changes/fragments/AdlChart.fragment.xml",
                "changes/coding/id_12345.js",
                "changes/id_1707741869990_200_flVariant.ctrl_variant",
                "changes/id_1707749484507_210_setTitle.ctrl_variant_change",
                "changes/id_1707749484509_240_setDefault.ctrl_variant_management_change"
            ]);
        });

        // subfolder changes are renamed
        // it("should rename changes/manifest", async () => await assertRename(appVariant.files, "manifest/id_1696839317668_changeInbound.change", "appVariant1-renamed/webapp")); => Merged and no longer needed
        it("should rename changes/coding", async () => await assertRename(processedFiles, "coding/id_12345.js", "appVariant1-renamed/webapp"));
        it("should rename changes/fragments", async () => await assertRename(processedFiles, "fragments/AdlChart.fragment.xml", "appVariant1-renamed/webapp"));
        // root folder changes are renamed
        it("should rename .change in changes root folder", async () => await assertRename(processedFiles, "id_1696839317667_propertyChange.change", "appVariant1-renamed/webapp"));
        it("should rename .ctrl_variant in changes root folder", async () => await assertRename(processedFiles, "id_1707741869990_200_flVariant.ctrl_variant", "appVariant1-renamed/webapp"));
        it("should rename .ctrl_variant_change in changes root folder", async () => await assertRename(processedFiles, "id_1707749484507_210_setTitle.ctrl_variant_change", "appVariant1-renamed/webapp"));
        it("should rename .ctrl_variant_management_change in changes root folder", async () => await assertRename(processedFiles, "id_1707749484509_240_setDefault.ctrl_variant_management_change", "appVariant1-renamed/webapp"));
        // it("should not rename .testfile in changes root folder", async () => {
        //     await assertRename(appVariant.files, "notsupported.testfile", "appVariant1-renamed/webapp")
        // }); => skipped because not supported

    });

    describe("when having change with url", () => {
        it("should adjust url when url to local file", async () => {
            await assertChangeUrl("annotations/annotation_1707246076536.xml", "changes/customer_base_app_id_variant1/annotations/annotation_1707246076536.xml");
        });
        it("shouldn't adjust url when url to service", async () => {
            await assertChangeUrl("/sap/opu/odata4/f4_sd_airlines_mduu/", "/sap/opu/odata4/f4_sd_airlines_mduu/");
        });
        it("should adjust url when url to local file", async () => {
            await assertChangeUrl("annotation_1707246076536.xml", "changes/customer_base_app_id_variant1/annotation_1707246076536.xml");
        });
    });

    describe("when process only manifest.appdescr_variant", () => {
        let manifest = {
            "reference": "base.app.id",
            "id": "customer.base.app.id.variant1",
            "content": [{
                "changeType": "appdescr_app_addAnnotationsToOData"
            }]
        } as any;
        const appVariant = (manifest: any) => AppVariant.fromFiles(new Map([["manifest.appdescr_variant", JSON.stringify(manifest)]]));
        it("shouldn't contain processed files", () => {
            expect(FilesUtil.filter(appVariant(manifest).files).size).eq(0);
        });
        it("shouldn't fill change layer if layer is undefined", () => {
            expect(appVariant(manifest).getProcessedManifestChanges()[0].layer).to.be.undefined
        });
        it("should fill change layer if manifest has layer", () => {
            const manifestClone = structuredClone(manifest);
            manifestClone.layer = "CUSTOMER_BASE";
            expect(appVariant(manifestClone).getProcessedManifestChanges()[0].layer).eq("CUSTOMER_BASE");
        });
    });

    describe("when processing change files", () => {
        let manifest = {
            "reference": "base.app.id",
            "id": "customer.base.app.id.variant1"
        };
        it("should contain manifest change with correct path", () => {
            const appVariant = AppVariant.fromFiles(new Map([
                ["manifest.appdescr_variant", JSON.stringify(manifest)],
                ["changes/id.change", `{ "changeType": "appdescr_change", "reference": "base.app.id" }`]
            ]));
            const files = FilesUtil.filter(appVariant.files);
            expect(files.size).eq(0);
            const manifestChanges = appVariant.getProcessedManifestChanges();
            expect(manifestChanges.length).eq(1);
            expect(manifestChanges[0]).eql({
                "changeType": "appdescr_change",
                "reference": "base.app.id"
            });
        });
        it("shouldn't contain manifest changes with confusing path", () => {
            const appVariant = AppVariant.fromFiles(new Map([
                ["manifest.appdescr_variant", JSON.stringify(manifest)],
                ["changes/manifestid.change", `{ "reference": "base.app.id" }`]
            ]));
            let files = FilesUtil.filter(appVariant.files);
            files = FilesUtil.rename(files, new Map([["base.app.id", appVariant.id]]));
            expect(files.size).eq(1);
            expect(files.get("changes/manifestid.change")).eql(`{ "reference": "customer.base.app.id.variant1" }`);
            expect(appVariant.getProcessedManifestChanges().length).eq(0);
        });
    });

    describe("when processing moved files", () => {
        let appVariant: AppVariant;
        before(async () => {
            appVariant = await AppVariant.fromWorkspace(workspace, NAMESPACE);
            appVariant.prefix = "app_variant1";

        });

        it("should return moved files", () => {
            const processedFiles = appVariant.getProcessedFiles();
            expect(!processedFiles.has("changes/coding/id_12345.js"));
            expect(processedFiles.has("changes/app_variant1/coding/id_12345.js"));

            expect(!processedFiles.has("changes/fragments/AdlChart.fragment.xml"));
            expect(processedFiles.has("changes/app_variant1/fragments/AdlChart.fragment.xml"));
        });

        it("should adjust paths for change files", () => {
            const processedFiles = appVariant.getProcessedFiles();
            const codeExtChange = processedFiles.get("changes/id_1753705046493_197_codeExt.change") || "";
            expect(JSON.parse(codeExtChange).content.codeRef).eql("app_variant1/coding/id_12345.js");
        });

        it("should adjust namespaces for controller extensions", () => {
            const processedFiles = appVariant.getProcessedFiles();
            const content = processedFiles.get("changes/app_variant1/coding/id_12345.js")?.trim() || "";
            expect(content).to.include(`ControllerExtension.extend("customer.com.sap.application.variant.id.app_variant1.Worklist.controller"`);
        });
    });
});

async function assertChangeUrl(testUrl: string, expectedUrl: string) {
    const changeResource = JSON.stringify({
        "changeType": "appdescr_app_addAnnotationsToOData",
        "content": {
            "dataSource": {
                "customer.annotation.annotation_1707246076536": {
                    "uri": testUrl,
                    "type": "ODataAnnotation"
                }
            }
        }
    });
    const manifestResource = JSON.stringify({
        "reference": "base.app.id",
        "id": "customer.base.app.id.variant1",
        "content": []
    });
    const resources = new Map([
        ["changes/id_1707246076536_addAnnotationsToOData.change", changeResource],
        ["manifest.appdescr_variant", manifestResource]]);
    const appVariant = await AppVariant.fromFiles(resources);
    const files = FilesUtil.filter(appVariant.files);
    expect(files.has("manifest.appdescr_variant")).to.be.false;
    const change = appVariant.getProcessedManifestChanges().find(change => change.changeType === "appdescr_app_addAnnotationsToOData") as any;
    expect(change.content.dataSource["customer.annotation.annotation_1707246076536"].uri)
        .to.eq(expectedUrl);
}

async function assertRename(files: ReadonlyMap<string, string>, filename: string, testResourcesFolder = "appVariant1/webapp") {
    const changeInboundChange = files.get(`changes/${filename}`);
    expect(changeInboundChange).to.eql(TestUtil.getResource(`${testResourcesFolder}/changes/${filename}`));
}