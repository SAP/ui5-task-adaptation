import * as sinon from "sinon";

import AbapRepoManager from "../../src/repositories/abapRepoManager.js"
import { IProjectOptions } from "../../src/model/types.js";
import { SinonSandbox } from "sinon";
import TestUtil from "../testUtilities/testUtil.js";
import axios from "axios";
import { expect } from "chai";

describe("AbapRepoManager", () => {
    let sandbox: SinonSandbox;
    const options: IProjectOptions = {
        projectNamespace: "ns",
        configuration: {
            destination: "abc",
            appName: "app/Name",
        }
    };

    let RESPONSE_DATA = JSON.parse(TestUtil.getResource("abap-response-archive.json"));

    beforeEach(async () => sandbox = sinon.createSandbox());
    afterEach(() => sandbox.restore());

    it("should return map of files from archive", async () => {
        const axiosStub = sandbox.stub(axios, "get").resolves(RESPONSE_DATA);
        const baseAppFiles = await new AbapRepoManager(options.configuration).downloadBaseAppFiles();
        expect([...baseAppFiles.keys()]).to.have.members(["i18n.properties", "manifest.json"]);
        expect(axiosStub.getCall(0).args[0]).to.eql("https://abc.dest/sap/opu/odata/UI5/ABAP_REPOSITORY_SRV/Repositories('app%2FName')?DownloadFiles=RUNTIME&CodePage=UTF8");
    });

    it("should throw exception when archive is empty", async () => {
        const responseClone = JSON.parse(JSON.stringify(RESPONSE_DATA));
        responseClone.data.d.ZipArchive = "";
        sandbox.stub(axios, "get").resolves(responseClone);
        await expect(new AbapRepoManager(options.configuration).downloadBaseAppFiles())
            .to.be.rejectedWith("App 'app/Name' from destination 'abc' doesn't contain files");
    });

    it("should create a correct repo uri", async () => {
        const axiosStub = sandbox.stub(axios, "get").resolves({ changedOn: "" });
        await new AbapRepoManager(options.configuration).getMetadata("appId1");
        expect(axiosStub.getCall(0).args[0]).to.eql("https://abc.dest/sap/bc/ui2/app_index/ui5_app_info_json?id=appId1");
    });
});
