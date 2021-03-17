import { SinonSandbox } from "sinon";
import * as sinon from "sinon";
import * as chai from "chai";
import TestUtil from "./util/testUtil";
import { IProjectOptions } from "../src/model/types";
import HTML5RepoManager from "../src/html5RepoManager";
import ResourceUtil from "../src/util/resourceUtil";
const index = require("../src/index");
const { expect } = chai;
const BASE_APP_ID = "com.sap.base.app.id";
const OPTIONS: IProjectOptions = {
    projectNamespace: "ns",
    configuration: {
        appHostId: "appHostId",
        appId: "appId",
        appName: "appName",
        appVersion: "appVersion",
        spaceGuid: "spaceGuid",
        orgGuid: "orgGuid",
        html5RepoRuntimeGuid: "html5RepoRuntimeGuid",
        sapCloudService: "sapCloudService"
    }
};

describe("Index", () => {
    let sandbox: SinonSandbox;

    beforeEach(() => sandbox = sinon.createSandbox());
    afterEach(() => sandbox.restore());

    after(async () => await ResourceUtil.deleteTemp(BASE_APP_ID));

    it("should download and write base files", async () => {
        const baseAppFiles = new Map([["manifest.json", TestUtil.getResource("manifest.json")]]);
        const html5RepoManagerStub = sandbox.stub(HTML5RepoManager, "getBaseAppFiles");
        html5RepoManagerStub.callsFake(() => Promise.resolve(baseAppFiles));
        await runUi5TaskAdaptation();
        expect(html5RepoManagerStub.getCalls().length).to.equal(1);
    });

    it("should read base app files from temp", async () => {
        const baseAppFiles = new Map([["manifest.json", TestUtil.getResource("manifest.json")]]);
        await ResourceUtil.writeTemp(BASE_APP_ID, baseAppFiles)
        const html5RepoManagerStub = sandbox.spy(HTML5RepoManager, "getBaseAppFiles");
        await runUi5TaskAdaptation();
        expect(html5RepoManagerStub.getCalls().length).to.equal(0);
    });

});

const runUi5TaskAdaptation = async () => {
    const { workspace, taskUtil } = await TestUtil.getWorkspace("appVariant1");
    const workspaceSpied = sinon.spy(workspace, "write");
    await index({ workspace, options: OPTIONS, taskUtil });
    const resourcePaths = workspaceSpied.getCalls().map(call => call.args[0].getPath());
    expect(resourcePaths).to.have.members([
        "/customer_com_sap_application_variant_id/i18n/i18n.properties",
        "/manifest.appdescr_variant",
        "/resources/ns/manifest.json"
    ]);
    const tempResources = await ResourceUtil.readTemp(BASE_APP_ID);
    expect([...tempResources.keys()]).to.have.members(["/manifest.json"]);
}