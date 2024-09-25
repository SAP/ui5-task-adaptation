import * as sinon from "sinon";

import { AbapServiceProvider, AppIndexService, Ui5AbapRepositoryService } from "@sap-ux/axios-extension";

import AbapProcessor from "../../src/processors/abapProcessor.js"
import AbapProvider from "../../src/repositories/abapProvider.js";
import AbapRepoManager from "../../src/repositories/abapRepoManager.js";
import AnnotationManager from "../../src/annotationManager.js";
import BaseAppFilesCacheManager from "../../src/cache/baseAppFilesCacheManager.js";
import { IProjectOptions } from "../../src/model/types.js";
import { SinonSandbox } from "sinon";
import TestUtil from "../testUtilities/testUtil.js";
import { expect } from "chai";

class AppIndexServiceMock extends AppIndexService { }

describe("AbapProcessor", () => {

    let sandbox: SinonSandbox;
    const options: IProjectOptions = {
        projectNamespace: "ns",
        configuration: {
            destination: "system",
            appName: "appName",
            target: {
                url: "https://example.sap.com"
            }
        }
    };

    const appIndexService = new AppIndexServiceMock();
    const ui5AbapRepositoryService = new Ui5AbapRepositoryService();
    const abapServiceProvider = new AbapServiceProvider();
    const abapProvider = new AbapProvider();
    const abapRepoManager = new AbapRepoManager(options.configuration, abapProvider);

    sandbox = sinon.createSandbox();
    sandbox.stub(abapServiceProvider, "getAppIndex").returns(appIndexService);
    sandbox.stub(abapServiceProvider, "getUi5AbapRepository").returns(ui5AbapRepositoryService);
    sandbox.stub(abapProvider, "get" as any).resolves(abapServiceProvider);

    const baseAppCacheManager = new BaseAppFilesCacheManager(options.configuration);
    const annotationManager = new AnnotationManager(options.configuration, abapRepoManager);
    const RESPONSE_DATA = TestUtil.getResource("abap-response-archive.json");

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
        delete process.env.ABAP_USERNAME;
        delete process.env.ABAP_PASSWORD;
        delete process.env.H2O_URL;
    });

    it("should get files from cache with same changedOn", async () => {
        const { appIndexServiceStub } = await when_downloading_files_with_metadata("010101");
        expect(appIndexServiceStub.getCalls().length).to.eql(1);
        expect(appIndexServiceStub.getCall(0).args[0]).to.eql("/ui5_app_info_json");
        expect(appIndexServiceStub.getCall(0).args[1]?.params.id).to.eql("com.sap.base.app.id");
    });

    it("should download files with different changedOn", async () => {
        const { appIndexServiceStub, ui5AbapRepositoryServiceStub, baseAppFiles } = await when_downloading_files_with_metadata("010102");
        expect(appIndexServiceStub.getCalls().length).to.eql(1);
        expect(appIndexServiceStub.getCall(0).args[0]).to.eql("/ui5_app_info_json");
        expect(appIndexServiceStub.getCall(0).args[1]?.params.id).to.eql("com.sap.base.app.id");
        expect(ui5AbapRepositoryServiceStub.getCalls().length).to.eql(1);
        expect(ui5AbapRepositoryServiceStub.getCall(0).args[0]).to.eql("/Repositories('appName')");
        expect([...baseAppFiles.keys()]).to.have.members(["i18n.properties", "manifest.json"]);
    });

    it("should do nothing with updateLandscapeSpecificContent", async () => {
        const annotationsProcessed = new Map([["annotation1", "annotationContent1"], ["annotation2", "annotationContent2"]]);
        const baseAppFiles = new Map([["baseAppFile1", "baseAppFileContent1"], ["baseAppFile2", "baseAppFileContent2"]]);
        const annotationManagerStub = sandbox.stub(annotationManager, "process").resolves(annotationsProcessed);
        await new AbapProcessor(options.configuration, baseAppCacheManager, abapRepoManager, annotationManager).updateLandscapeSpecificContent({}, baseAppFiles);
        expect(annotationManagerStub.getCalls().length).to.eql(1);
        expect([...baseAppFiles.keys()]).to.have.members(["annotation1", "annotation2", "baseAppFile1", "baseAppFile2"]);
    });

    async function when_downloading_files_with_metadata(cacheBusterToken: string) {
        const appIndexServiceStub = sandbox.stub(appIndexService, "get")
            .resolves({ data: JSON.stringify({ "com.sap.base.app.id": { url: cacheBusterToken } }) });
        const ui5AbapRepositoryServiceStub = sandbox.stub(ui5AbapRepositoryService, "get").resolves({ data: RESPONSE_DATA });

        const baseAppCacheManager = new BaseAppFilesCacheManager(options.configuration);
        sandbox.stub(baseAppCacheManager, "readTempMetadata").returns({ changedOn: "010101", id: "com.sap.base.app.id" });
        sandbox.stub(baseAppCacheManager, "writeTemp");
        const abapProcessor = new AbapProcessor(options.configuration, baseAppCacheManager, abapRepoManager, annotationManager);
        const baseAppFiles = await abapProcessor.getBaseAppFiles("com.sap.base.app.id");
        return { appIndexServiceStub, ui5AbapRepositoryServiceStub, baseAppFiles };
    }

    it("should get metadata after downloading files", async () => {
        const { appIndexServiceStub, baseAppFiles, writeTempStub } = await when_no_cache_yet("010102");
        expect(appIndexServiceStub.getCalls().length).to.eql(1);
        expect(appIndexServiceStub.getCall(0).args[0]).to.eql("/ui5_app_info_json");
        expect(appIndexServiceStub.getCall(0).args[1]?.params.id).to.eql("sap.ui.rta.test.variantManagement.business.service");
        writeTempStub.getCall(0).args[1];
        const metadataJson = writeTempStub.getCall(0).args[1];
        expect(metadataJson).to.eql({ changedOn: "010102", id: "sap.ui.rta.test.variantManagement.business.service" });
        expect([...baseAppFiles.keys()]).to.have.members(["i18n.properties", "manifest.json"]);
    });

    async function when_no_cache_yet(url: string) {
        const appIndexServiceStub = sandbox.stub(appIndexService, "get")
            .resolves({ data: JSON.stringify({ "sap.ui.rta.test.variantManagement.business.service": { url } }) });
        const ui5AbapRepositoryServiceStub = sandbox.stub(ui5AbapRepositoryService, "get").resolves({ data: RESPONSE_DATA });
        const baseAppCacheManager = new BaseAppFilesCacheManager(options.configuration);
        sandbox.stub(baseAppCacheManager, "readTempMetadata").returns(undefined);
        const writeTempStub = sandbox.stub(baseAppCacheManager, "writeTemp");
        const abapProcessor = new AbapProcessor(options.configuration, baseAppCacheManager, abapRepoManager, annotationManager);
        const baseAppFiles = await abapProcessor.getBaseAppFiles("sap.ui.rta.test.variantManagement.business.service");
        return { appIndexServiceStub, ui5AbapRepositoryServiceStub, writeTempStub, baseAppFiles };
    }

    it("should take destination from SAP BAS", async () => {
        const { appIndexServiceStub, baseAppFiles, writeTempStub } = await when_no_cache_yet("010102");
        expect(appIndexServiceStub.getCalls().length).to.eql(1);
        expect(appIndexServiceStub.getCall(0).args[0]).to.eql("/ui5_app_info_json");
        expect(appIndexServiceStub.getCall(0).args[1]?.params.id).to.eql("sap.ui.rta.test.variantManagement.business.service");
        writeTempStub.getCall(0).args[1];
        const metadataJson = writeTempStub.getCall(0).args[1];
        expect(metadataJson).to.eql({ changedOn: "010102", id: "sap.ui.rta.test.variantManagement.business.service" });
        expect([...baseAppFiles.keys()]).to.have.members(["i18n.properties", "manifest.json"]);
    });
});
