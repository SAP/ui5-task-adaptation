import * as sinon from "sinon";

import AbapProvider from "../../../src/repositories/abapProvider.js";
import AbapRepoManager from "../../../src/repositories/abapRepoManager.js";
import AnnotationManager from "../../../src/annotationManager.js";
import CacheHolder from "../../../src/cache/cacheHolder.js";
import { IProjectOptions } from "../../../src/model/types.js";
import { SinonSandbox } from "sinon";
import { expect } from "chai";
import DownloadAnnotationsCommand from "../../../src/adapters/commands/downloadAnnotationsCommand.js";
import AbapProcessor from "../../../src/processors/abapProcessor.js";

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

    const abapProvider = new AbapProvider();
    const abapRepoManager = new AbapRepoManager(options.configuration, abapProvider);
    const annotationManager = new AnnotationManager(options.configuration, abapRepoManager);


    after(() => CacheHolder.clear());

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
        delete process.env.ABAP_USERNAME;
        delete process.env.ABAP_PASSWORD;
        delete process.env.H2O_URL;
    });

    it("should do nothing with updateLandscapeSpecificContent", async () => {
        const annotationsProcessed = new Map([["annotation1", "annotationContent1"], ["annotation2", "annotationContent2"]]);
        const baseAppFiles = new Map([["manifest.json", "{}"], ["baseAppFile2", "baseAppFileContent2"]]);
        const annotationManagerStub = sandbox.stub(annotationManager, "process").resolves(annotationsProcessed);
        const command = new DownloadAnnotationsCommand("appVarId", "customer_com_sap_application_variant_id", annotationManager, options.configuration)
        await command.execute(baseAppFiles, "manifest.json");
        expect(annotationManagerStub.getCalls().length).to.eql(1);
        expect([...baseAppFiles.keys()]).to.have.members(["annotation1", "annotation2", "manifest.json", "baseAppFile2"]);
    });

    it("should raise an error when downloading reuse libs in preview mode", async () => {
        const abapProcessor = new AbapProcessor(options.configuration, abapRepoManager, annotationManager);
        try {
            await abapProcessor.fetchReuseLib();
        } catch (error) {
            expect((error as Error).message).to.eql("Preview is not available on SAP S/4HANA On-Premise or Cloud Systems. Please create a ticket on CA-UI5-FL-ADP-BAS component.");
        }
    });
});
