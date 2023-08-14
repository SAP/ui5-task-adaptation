import * as chai from "chai";
import * as sinon from "sinon";

import BaseAppFilesCacheManager from "../../src/cache/baseAppFilesCacheManager";
import CFProcessor from "../../src/processors/cfProcessor";
import HTML5RepoManager from "../../src/repositories/html5RepoManager";
import { IProjectOptions } from "../../src/model/types";
import { SinonSandbox } from "sinon";

const { expect } = chai;

describe("BaseAppFilesCacheManager", () => {
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
        const cacheManager = new BaseAppFilesCacheManager(options.configuration);
        sandbox.stub(cacheManager, "readTempMetadata").callsFake(() => DOWNLOADED_METADATA);
        const html5RepoManagerStub = sandbox.spy(HTML5RepoManager, "getBaseAppFiles");
        await new CFProcessor(options.configuration, cacheManager).getBaseAppFiles();
        expect(html5RepoManagerStub.getCalls().length).to.equal(0);
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
    const cacheManager = new BaseAppFilesCacheManager(options.configuration);
    sandbox.stub(HTML5RepoManager, "getMetadata").callsFake(() => Promise.resolve(DOWNLOADED_METADATA));
    sandbox.stub(cacheManager, "readTempMetadata").callsFake(() => cacheMetadata);
    const html5RepoManagerStub = sandbox.stub(HTML5RepoManager, "getBaseAppFiles");
    html5RepoManagerStub.callsFake(() => Promise.resolve(new Map()));
    const resourceUtilStub = sandbox.stub(cacheManager, "writeTemp");
    expect(await new CFProcessor(options.configuration, cacheManager).getBaseAppFiles()).to.be.true;
    expect(html5RepoManagerStub.getCalls().length).to.equal(1);
    expect(resourceUtilStub.getCalls().length).to.equal(1);
}