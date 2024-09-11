import * as sinon from "sinon";

import { AbapServiceProvider, AppIndexService, Ui5AbapRepositoryService } from "@sap-ux/axios-extension";

import AbapProvider from "../../src/repositories/abapProvider.js";
import AbapRepoManager from "../../src/repositories/abapRepoManager.js"
import { IProjectOptions } from "../../src/model/types.js";
import { SinonSandbox } from "sinon";
import TestUtil from "../testUtilities/testUtil.js";
import { expect } from "chai";

class AppIndexServiceMock extends AppIndexService { }

describe("AbapRepoManager", () => {
    let sandbox: SinonSandbox;
    const options: IProjectOptions = {
        projectNamespace: "ns",
        configuration: {
            destination: "abc",
            appName: "app/Name"
        }
    };

    let RESPONSE_DATA = { data: TestUtil.getResource("abap-response-archive.json") };

    beforeEach(async () => sandbox = sinon.createSandbox());
    afterEach(() => sandbox.restore());

    it("should return map of files from archive", async () => {
        const { abapRepoManager, ui5AbapRepositoryServiceStub } = prepareServiceStubs(RESPONSE_DATA);
        const baseAppFiles = await abapRepoManager.downloadBaseAppFiles();
        expect([...baseAppFiles.keys()]).to.have.members(["i18n.properties", "manifest.json"]);
        expect(ui5AbapRepositoryServiceStub.getCall(0).args[0]).to.eql("/Repositories('app%2FName')");
    });

    it("should throw exception when archive is empty", async () => {
        const responseClone = JSON.parse(RESPONSE_DATA.data);
        responseClone.d.ZipArchive = "";
        const { abapRepoManager } = prepareServiceStubs({ data: JSON.stringify(responseClone) });
        await expect(abapRepoManager.downloadBaseAppFiles())
            .to.be.rejectedWith("App 'app/Name' from 'abc' doesn't contain files");
    });

    function prepareServiceStubs(response: any) {
        const appIndexService = new AppIndexServiceMock();
        const ui5AbapRepositoryService = new Ui5AbapRepositoryService();
        const abapServiceProvider = new AbapServiceProvider();
        const abapProvider = new AbapProvider();
        const abapRepoManager = new AbapRepoManager(options.configuration, abapProvider);
        sandbox.stub(abapServiceProvider, "getAppIndex").returns(appIndexService);
        sandbox.stub(abapServiceProvider, "getUi5AbapRepository").returns(ui5AbapRepositoryService);
        const createProvider = sandbox.stub(abapProvider, "createProvider" as any).resolves(abapServiceProvider);
        const validateAndGetTargetConfiguration = sandbox.spy(AbapProvider, "validateAndGetTargetConfiguration");
        const ui5AbapRepositoryServiceStub = sandbox.stub(ui5AbapRepositoryService, "get").resolves(response);
        return { abapRepoManager, ui5AbapRepositoryServiceStub, validateAndGetTargetConfiguration, createProvider };
    }
});
