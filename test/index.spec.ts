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
        await runUi5TaskAdaptation(OPTIONS);
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
        await runUi5TaskAdaptation(OPTIONS);
        expect(html5RepoManagerStub.getCalls().length).to.equal(0);
    });

});

const runUi5TaskAdaptation = async (options: IProjectOptions) => {
    const { workspace, taskUtil } = await TestUtil.getWorkspace("appVariant1");
    const workspaceSpied = sinon.spy(workspace, "write");
    await index({ workspace, options: options, taskUtil });
    const resourcePaths = workspaceSpied.getCalls().map(call => call.args[0].getPath());
    expect(resourcePaths).to.have.members([
        "/customer_com_sap_application_variant_id/i18n/i18n.properties",
        "/manifest.appdescr_variant",
        "/resources/ns/manifest.json"
    ]);
    const tempResources = await cacheManager.readTemp();
    expect([...tempResources.keys()]).to.have.members(["/manifest.json"]);
}