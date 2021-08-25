import * as chai from "chai";
import * as sinon from "sinon";

import HTML5RepoManager from "../src/html5RepoManager";
import { IProjectOptions } from "../src/model/types";
import ResourceUtil from "../src/util/resourceUtil";
import { SinonSandbox } from "sinon";
import updateCache from "../src/updateCache";

const { expect } = chai;

describe("UpdateCache", () => {
    let sandbox: SinonSandbox;
    const options: IProjectOptions = {
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

    beforeEach(async () => sandbox = sinon.createSandbox());
    afterEach(() => sandbox.restore());

    it("shouldn't update cache when the same metadata", async () => {
        const DOWNLOADED_METADATA = { changedOn: "2100.01.01" };
        sandbox.stub(HTML5RepoManager, "getMetadata").callsFake(() => Promise.resolve(DOWNLOADED_METADATA));
        sandbox.stub(ResourceUtil, "readTempMetadata").callsFake(() => DOWNLOADED_METADATA);
        expect(await updateCache(options.configuration)).to.be.false;
    });

    it("shouldn't update cache when the same metadata", async () => {
        downloadFiles(options, sandbox, undefined);
    });

    it("should update cache when chagedOn is different", async () => {
        downloadFiles(options, sandbox, { changedOn: "2100.01.01" });
    });

});

const downloadFiles = async (options: IProjectOptions, sandbox: SinonSandbox, cacheMetadata: any) => {
    const DOWNLOADED_METADATA = { changedOn: "2100.01.02" };
    sandbox.stub(HTML5RepoManager, "getMetadata").callsFake(() => Promise.resolve(DOWNLOADED_METADATA));
    sandbox.stub(ResourceUtil, "readTempMetadata").callsFake(() => cacheMetadata);
    const html5RepoManagerStub = sandbox.stub(HTML5RepoManager, "getBaseAppFiles");
    html5RepoManagerStub.callsFake(() => Promise.resolve(new Map()));
    const resourceUtilStub = sandbox.stub(ResourceUtil, "writeTemp");
    expect(await updateCache(options.configuration)).to.be.true;
    expect(html5RepoManagerStub.getCalls().length).to.equal(1);
    expect(resourceUtilStub.getCalls().length).to.equal(1);
}