import * as chai from "chai";
import * as sinon from "sinon";

import BaseAppFilesCacheManager from "../src/cache/baseAppFilesCacheManager";
import HTML5RepoManager from "../src/repositories/html5RepoManager";
import { IProjectOptions } from "../src/model/types";
import { SinonSandbox } from "sinon";
import TestUtil from "./util/testUtil";

const index = require("../src/index");
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
        sapCloudService: "sapCloudService"
    }
};
const cacheManager = new BaseAppFilesCacheManager(OPTIONS.configuration);

describe("Index", () => {
    let sandbox: SinonSandbox;

    beforeEach(() => sandbox = sinon.createSandbox());
    afterEach(() => sandbox.restore());

    after(async () => await cacheManager.deleteTemp());

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
});

const runUi5TaskAdaptation = async (options: IProjectOptions, hasEnhanceWithForI18NModel: boolean) => {
    const { workspace, taskUtil } = await TestUtil.getWorkspace("appVariant1", options.projectNamespace);
    const workspaceSpied = sinon.spy(workspace, "write");
    await index({ workspace, options: options, taskUtil });
    const resourcePaths = workspaceSpied.getCalls().map(call => call.args[0].getPath());
    const manifestJsonResource = workspaceSpied.getCalls().find(resource => resource.args[0].getPath().includes("manifest.json")) as any;
    const manifestJson = JSON.parse(await manifestJsonResource.args[0]?.getString());
    if (hasEnhanceWithForI18NModel && manifestJson) {
        expect(Object.keys(manifestJson["sap.ui5"]["models"]["@i18n"])).to.have.members(["type", "settings"]);
    } else {
        expect(Object.keys(manifestJson["sap.ui5"]["models"]["@i18n"])).to.not.have.members(["settings"]);
    }
    expect(resourcePaths).to.have.members([
        "/resources/ns/customer_com_sap_application_variant_id/i18n/i18n.properties",
        "/resources/ns/manifest.appdescr_variant",
        "/resources/ns/manifest.json",
        "/resources/ns/changes/id_1696839317667_propertyChange.change",
        "/resources/ns/changes/manifest/id_1696839317668_changeInbound.change",
        "/resources/ns/changes/fragments/AdlChart.fragment.xml",
        "/resources/ns/changes/coding/id_12345.js"
    ]);
    const tempResources = await cacheManager.readTemp();
    expect([...tempResources.keys()]).to.have.members(["/manifest.json"]);
}