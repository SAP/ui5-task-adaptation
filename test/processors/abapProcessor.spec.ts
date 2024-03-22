import * as sinon from "sinon";

import AbapProcessor from "../../src/processors/abapProcessor.js"
import AbapRepoManager from "../../src/repositories/abapRepoManager.js";
import AnnotationManager from "../../src/annotationManager.js";
import BaseAppFilesCacheManager from "../../src/cache/baseAppFilesCacheManager.js";
import { IProjectOptions } from "../../src/model/types.js";
import { SinonSandbox } from "sinon";
import TestUtil from "../testUtilities/testUtil.js";
import axios from "axios";
import { expect } from "chai";

describe("AbapProcessor", () => {

    let sandbox: SinonSandbox;
    const options: IProjectOptions = {
        projectNamespace: "ns",
        configuration: {
            destination: "system",
            appName: "appName",
            credentials: {
                username: "env:ABAP_USERNAME",
                password: "env:ABAP_PASSWORD"
            }
        }
    };
    const abapRepoManager = new AbapRepoManager(options.configuration);
    const baseAppCacheManager = new BaseAppFilesCacheManager(options.configuration);
    const annotationManager = new AnnotationManager(options.configuration, abapRepoManager);

    let RESPONSE_DATA = JSON.parse(TestUtil.getResource("abap-response-archive.json"));

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });
    afterEach(() => {
        sandbox.restore();
        delete process.env.ABAP_USERNAME;
        delete process.env.ABAP_PASSWORD;
    });

    it("should get files from cache with same changedOn", async () => {
        const { axiosStub } = await when_downloading_files_with_metadata("010101");
        expect(axiosStub.getCalls().length).to.eql(2);
        expect(axiosStub.getCall(0).args[0]).to.eql("https://system.dest/sap/bc/ui2/app_index/ui5_app_info_json?id=com.sap.base.app.id");
    });

    it("should download files with different changedOn", async () => {
        const { axiosStub, baseAppFiles } = await when_downloading_files_with_metadata("010102");
        expect(axiosStub.getCalls().length).to.eql(2);
        expect(axiosStub.getCall(0).args[0]).to.eql("https://system.dest/sap/bc/ui2/app_index/ui5_app_info_json?id=com.sap.base.app.id");
        expect(axiosStub.getCall(1).args[0]).to.eql("https://system.dest/sap/opu/odata/UI5/ABAP_REPOSITORY_SRV/Repositories('appName')?DownloadFiles=RUNTIME&CodePage=UTF8")
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

    it("should validate abap config", async () => {
        new AbapProcessor(options.configuration, baseAppCacheManager, abapRepoManager, annotationManager).validateConfiguration();
    });

    it("should not validate cf config", async () => {
        const abapProcessor = new AbapProcessor({
            appHostId: "https://system.sap.com:443",
            appName: "appName",
        }, baseAppCacheManager, abapRepoManager, annotationManager);
        expect(abapProcessor.validateConfiguration.bind(abapProcessor)).to.throw("'destination' should be specified in ui5.yaml configuration");
    });

    it("should send request with auth since no principal propagation", async () => {
        process.env.ABAP_USERNAME = 'ABAP_USERNAME_VALUE';
        process.env.ABAP_PASSWORD = 'ABAP_PASSWORD_VALUE';
        const baseAppCacheManager = new BaseAppFilesCacheManager(options.configuration);
        sandbox.stub(baseAppCacheManager, "readTempMetadata").returns({ changedOn: "010101", id: "sap.ui.rta.test.variantManagement.business.service" });
        sandbox.stub(baseAppCacheManager, "writeTemp");
        const abapRepoManager = new AbapRepoManager(options.configuration);
        const abapRepoManagerSpy = sandbox.spy(abapRepoManager, "getMetadataRequest" as any);
        const axiosStub = sandbox.stub(axios, "get")
            .onCall(0).rejects({ response: { status: 401 } })
            .onCall(1).resolves({ data: { "sap.ui.rta.test.variantManagement.business.service": { manifest: "010102" } } })
            .onCall(2).rejects({ response: { status: 401 } })
            .onCall(3).resolves(RESPONSE_DATA);
        const abapProcessor = new AbapProcessor(options.configuration, baseAppCacheManager, abapRepoManager, annotationManager);
        await abapProcessor.getBaseAppFiles("sap.ui.rta.test.variantManagement.business.service");
        expect(axiosStub.getCalls().length).to.eql(4);
        expect(abapRepoManagerSpy.getCall(0).args.length).to.eql(1);
        expect(abapRepoManagerSpy.getCall(1).args[1]).to.eql({
            username: process.env.ABAP_USERNAME,
            password: process.env.ABAP_PASSWORD
        });
    });

    it("should throw error since server returns 500", async () => {
        process.env.ABAP_USERNAME = 'ABAP_USERNAME_VALUE';
        process.env.ABAP_PASSWORD = 'ABAP_PASSWORD_VALUE';
        const baseAppCacheManager = new BaseAppFilesCacheManager(options.configuration);
        sandbox.stub(baseAppCacheManager, "readTempMetadata").returns({ changedOn: "010101", id: "sap.ui.rta.test.variantManagement.business.service" });
        sandbox.stub(baseAppCacheManager, "writeTemp");
        const abapRepoManager = new AbapRepoManager(options.configuration);
        sandbox.spy(abapRepoManager, "getMetadata");
        sandbox.stub(axios, "get")
            .onCall(0).rejects({ response: { status: 500, data: "reponse data" } })
            .onCall(1).resolves({ data: { "sap.ui.rta.test.variantManagement.business.service": { manifest: "010102" } } });
        const abapProcessor = new AbapProcessor(options.configuration, baseAppCacheManager, abapRepoManager, annotationManager);
        await expect(abapProcessor.getBaseAppFiles(
            "sap.ui.rta.test.variantManagement.business.service"
        )).to.be.rejectedWith("Request https://system.dest/sap/bc/ui2/app_index/ui5_app_info_json?id=sap.ui.rta.test.variantManagement.business.service failed with Server error: 500");
    });

    async function when_downloading_files_with_metadata(cacheBusterToken: string) {
        const axiosStub = sandbox.stub(axios, "get")
            .onCall(0).resolves({ data: { "sap.ui.rta.test.variantManagement.business.service": { manifest: cacheBusterToken } } })
            .onCall(1).resolves(RESPONSE_DATA);
        const baseAppCacheManager = new BaseAppFilesCacheManager(options.configuration);
        sandbox.stub(baseAppCacheManager, "readTempMetadata").returns({ changedOn: "010101", id: "sap.ui.rta.test.variantManagement.business.service" });
        sandbox.stub(baseAppCacheManager, "writeTemp");
        const abapProcessor = new AbapProcessor(options.configuration, baseAppCacheManager, abapRepoManager, annotationManager);
        const baseAppFiles = await abapProcessor.getBaseAppFiles("com.sap.base.app.id");
        return { axiosStub, baseAppFiles };
    }

    it("should get metadata after downloading files", async () => {
        const { axiosStub, baseAppFiles, writeTempStub } = await when_no_cache_yet("010102");
        expect(axiosStub.getCalls().length).to.eql(2);
        expect(axiosStub.getCall(0).args[0]).to.eql("https://system.dest/sap/bc/ui2/app_index/ui5_app_info_json?id=sap.ui.rta.test.variantManagement.business.service");
        expect(axiosStub.getCall(1).args[0]).to.eql("https://system.dest/sap/opu/odata/UI5/ABAP_REPOSITORY_SRV/Repositories('appName')?DownloadFiles=RUNTIME&CodePage=UTF8");
        writeTempStub.getCall(0).args[1];
        const metadataJson = writeTempStub.getCall(0).args[1];
        expect(metadataJson).to.eql({ changedOn: "010102", id: "sap.ui.rta.test.variantManagement.business.service" });
        expect([...baseAppFiles.keys()]).to.have.members(["i18n.properties", "manifest.json"]);
    });

    async function when_no_cache_yet(url: string) {
        const axiosStub = sandbox.stub(axios, "get")
            .onCall(1).resolves(RESPONSE_DATA)
            .onCall(0).resolves({ data: { "sap.ui.rta.test.variantManagement.business.service": { url } } });
        const baseAppCacheManager = new BaseAppFilesCacheManager(options.configuration);
        sandbox.stub(baseAppCacheManager, "readTempMetadata").returns(undefined);
        const writeTempStub = sandbox.stub(baseAppCacheManager, "writeTemp");
        const abapProcessor = new AbapProcessor(options.configuration, baseAppCacheManager, abapRepoManager, annotationManager);
        const baseAppFiles = await abapProcessor.getBaseAppFiles("sap.ui.rta.test.variantManagement.business.service");
        return { axiosStub, writeTempStub, baseAppFiles };
    }
});
