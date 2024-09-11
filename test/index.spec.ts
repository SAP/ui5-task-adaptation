import * as chai from "chai";
import * as sinon from "sinon";

import AppVariantManager from "../src/appVariantManager.js";
import BaseAppFilesCacheManager from "../src/cache/baseAppFilesCacheManager.js";
import HTML5RepoManager from "../src/repositories/html5RepoManager.js";
import { IProjectOptions } from "../src/model/types.js";
import { SinonSandbox } from "sinon";
import TestUtil from "./testUtilities/testUtil.js";
import index from "../src/index.js";

const { byIsOmited } = TestUtil;

const { expect } = chai;
const OPTIONS: IProjectOptions = {
    projectNamespace: "ns",
    configuration: {
        appHostId: "appHostId",
        appId: "appId",
        appName: "appName",
        appVersion: "appVersion",
        spaceGuid: "spaceGuid",
        orgGuid: "orgGuid",
        sapCloudService: "sapCloudService",
        connections: [{
            url: "https://example.sap.com"
        }]
    }
};
const cacheManager = new BaseAppFilesCacheManager(OPTIONS.configuration);

describe("Index", () => {
    let sandbox: SinonSandbox;

    beforeEach(() => sandbox = sinon.createSandbox());
    afterEach(() => sandbox.restore());

    afterEach(async () => await cacheManager.deleteTemp());

    it("should download and write base files because metadata is different", async () => {
        const baseAppFiles = new Map([["manifest.json", TestUtil.getResource("manifest.json")]]);
        const html5RepoManagerStub = sandbox.stub(HTML5RepoManager, "getBaseAppFiles");
        sandbox.stub(cacheManager, "readTempMetadata" as any).callsFake(() => Promise.resolve({ changedOn: "2100.01.01" }));
        sandbox.stub(HTML5RepoManager, "getMetadata").callsFake(() => Promise.resolve({ changedOn: "2100.01.01" }));
        html5RepoManagerStub.callsFake(() => Promise.resolve(baseAppFiles));
        await runUi5TaskAdaptation(OPTIONS, false);
        expect(html5RepoManagerStub.getCalls().length).to.equal(1);
    });

    it("should read base app files from temp because metadata is the same", async () => {
        const DOWNLOADED_METADATA = { changedOn: "2100.01.01" };
        const baseAppFiles = new Map([
            ["manifest.json", TestUtil.getResource("manifest.json")]
        ]);
        await cacheManager.writeTemp(baseAppFiles, DOWNLOADED_METADATA);
        const html5RepoManagerStub = sandbox.spy(HTML5RepoManager, "getBaseAppFiles");
        sandbox.stub(HTML5RepoManager, "getMetadata").callsFake(() => Promise.resolve(DOWNLOADED_METADATA));
        await runUi5TaskAdaptation(OPTIONS, false);
        expect(html5RepoManagerStub.getCalls().length).to.equal(0);
    });

    it("should read base app files from temp because metadata is the same and add enhanceWith to i18n model in manifest.json", async () => {
        const DOWNLOADED_METADATA = { changedOn: "2100.01.01" };
        const baseAppFiles = new Map([
            ["manifest.json", TestUtil.getResource("manifest.json")]
        ]);
        await cacheManager.writeTemp(baseAppFiles, DOWNLOADED_METADATA);
        const html5RepoManagerStub = sandbox.spy(HTML5RepoManager, "getBaseAppFiles");
        sandbox.stub(HTML5RepoManager, "getMetadata").callsFake(() => Promise.resolve(DOWNLOADED_METADATA));
        OPTIONS.configuration.languages = ["EN", "DE"];
        await runUi5TaskAdaptation(OPTIONS, true);
        expect(html5RepoManagerStub.getCalls().length).to.equal(0);
        delete OPTIONS.configuration.languages;
    });

    [
        { testName: "string", manifestModification: () => { } },
        {
            testName: "bundleUrl", manifestModification: (baseAppFiles: Map<string, string>) => {
                const manifestJson = JSON.parse(baseAppFiles.get("manifest.json")!);
                manifestJson["sap.app"]["i18n"] = { "bundleUrl": "i18n/i18n.properties" };
                baseAppFiles.set("manifest.json", JSON.stringify(manifestJson));
            }
        },
        {
            testName: "bundleName", manifestModification: (baseAppFiles: Map<string, string>) => {
                const manifestJson = JSON.parse(baseAppFiles.get("manifest.json")!);
                manifestJson["sap.app"]["i18n"] = { "bundleName": "com.sap.base.app.id.i18n.i18n" };
                baseAppFiles.set("manifest.json", JSON.stringify(manifestJson));
            }
        }]
        .forEach((test) => {
            it(`should merge i18n files from base app and variant with given i18n manifest ${test.testName}`, async () => {
                const baseAppFiles = new Map([
                    ["manifest.json", TestUtil.getResource("manifest.json")],
                    ["i18n/i18n.properties", TestUtil.getResource("i18n.properties")]
                ]);
                test.manifestModification(baseAppFiles);
                const html5RepoManagerStub = sandbox.stub(HTML5RepoManager, "getBaseAppFiles");
                sandbox.stub(cacheManager, "readTempMetadata" as any).callsFake(() => Promise.resolve({ changedOn: "2100.01.01" }));
                sandbox.stub(HTML5RepoManager, "getMetadata").callsFake(() => Promise.resolve({ changedOn: "2100.01.01" }));
                html5RepoManagerStub.callsFake(() => Promise.resolve(baseAppFiles));
                const { workspace, taskUtil } = await getWorkspace(OPTIONS);
                const appVariantResources = await AppVariantManager.getAppVariantResourcesToProcess(workspace);
                sandbox.stub(AppVariantManager, "getAppVariantResourcesToProcess").callsFake(() => Promise.resolve(appVariantResources));

                await index({ workspace, options: OPTIONS, taskUtil });

                const resources: any[] = (await workspace.byGlob("/**/*")).filter(byIsOmited(taskUtil));
                const resourcePaths = resources.map(r => r.getPath());
                const resourcePathMembers = [
                    "/resources/ns/manifest.json",
                    "/resources/ns/i18n/i18n.properties",
                    "/resources/ns/changes/id_1696839317667_propertyChange.change",
                    "/resources/ns/i18n/i18n_de.properties",
                    "/resources/ns/changes/fragments/AdlChart.fragment.xml",
                    "/resources/ns/changes/coding/id_12345.js",
                    "/resources/ns/changes/id_1707741869990_200_flVariant.ctrl_variant",
                    "/resources/ns/changes/id_1707749484507_210_setTitle.ctrl_variant_change",
                    "/resources/ns/changes/id_1707749484509_240_setDefault.ctrl_variant_management_change",
                    "/resources/ns/changes/notsupported.testfile"
                ];
                const tempResources = await cacheManager.readTemp();
                const tempResourcesMembers = [
                    "i18n/i18n.properties",
                    "manifest.json"
                ];
                checkResourcePathsAndTempResources(resourcePaths, resourcePathMembers, tempResources, tempResourcesMembers);
                const i18nResources = resources.filter(resources => resources.getPath().includes("i18n"));

                const actualI18NFile = await Promise.all(i18nResources.map(async r => [r.getPath(), await r.getString()]));
                expect(actualI18NFile).to.have.deep.members([
                    ["/resources/ns/i18n/i18n_de.properties", TestUtil.getResource("i18n_de-expected.properties")],
                    ["/resources/ns/i18n/i18n.properties", TestUtil.getResource("i18n-expected.properties")]
                ]);

                expect(html5RepoManagerStub.getCalls().length).to.equal(1);
            });
        });
});

const getWorkspace = async (options: IProjectOptions) => {
    const { workspace, taskUtil } = await TestUtil.getWorkspace("appVariant1", options.projectNamespace);
    return { workspace, taskUtil }
}

const checkResourcePathsAndTempResources = (resourcePaths: any[], resourcePathsMembers: string[], tempResources: Map<string, string>, tempResourcesMembers: string[]) => {
    expect(resourcePaths).to.have.members(resourcePathsMembers);
    expect([...tempResources.keys()]).to.have.members(tempResourcesMembers);
}

const runUi5TaskAdaptation = async (options: IProjectOptions, hasEnhanceWithForI18NModel: boolean) => {
    const { workspace, taskUtil } = await getWorkspace(options);
    await index({ workspace, options, taskUtil });
    const resources: any[] = (await workspace.byGlob("/**/*")).filter(byIsOmited(taskUtil));
    const resourcePaths = resources.map(r => r.getPath());

    const manifestJsonResource: any = resources.find(resource => resource.getPath().includes("manifest.json")) as any;
    const manifestJson = JSON.parse(await manifestJsonResource?.getString());
    if (hasEnhanceWithForI18NModel && manifestJson) {
        expect(Object.keys(manifestJson["sap.ui5"]["models"]["@i18n"])).to.have.members(["type", "settings"]);
    } else {
        expect(Object.keys(manifestJson["sap.ui5"]["models"]["@i18n"])).to.not.have.members(["settings"]);
    }
    const resourcePathsMembers = [
        "/resources/ns/manifest.json",
        "/resources/ns/i18n/i18n_de.properties",
        "/resources/ns/changes/id_1696839317667_propertyChange.change",
        "/resources/ns/i18n/i18n.properties",
        "/resources/ns/changes/fragments/AdlChart.fragment.xml",
        "/resources/ns/changes/coding/id_12345.js",
        "/resources/ns/changes/id_1707741869990_200_flVariant.ctrl_variant",
        "/resources/ns/changes/id_1707749484507_210_setTitle.ctrl_variant_change",
        "/resources/ns/changes/id_1707749484509_240_setDefault.ctrl_variant_management_change",
        "/resources/ns/changes/notsupported.testfile"
    ];
    const tempResources = await cacheManager.readTemp();
    checkResourcePathsAndTempResources(resourcePaths, resourcePathsMembers, tempResources, ["manifest.json"]);
}