import * as sinon from "sinon";

import AbapProcessor from "../../../src/processors/abapProcessor.js"
import AbapProvider from "../../../src/repositories/abapProvider.js";
import AbapRepoManager from "../../../src/repositories/abapRepoManager.js";
import AnnotationManager from "../../../src/annotationManager.js";
import CacheHolder from "../../../src/cache/cacheHolder.js";
import { IProjectOptions } from "../../../src/model/types.js";
import { SinonSandbox } from "sinon";
import { expect } from "chai";

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
        const baseAppFiles = new Map([["baseAppFile1", "baseAppFileContent1"], ["baseAppFile2", "baseAppFileContent2"]]);
        const annotationManagerStub = sandbox.stub(annotationManager, "process").resolves(annotationsProcessed);
        await new AbapProcessor(options.configuration, abapRepoManager, annotationManager).updateLandscapeSpecificContent({}, baseAppFiles);
        expect(annotationManagerStub.getCalls().length).to.eql(1);
        expect([...baseAppFiles.keys()]).to.have.members(["annotation1", "annotation2", "baseAppFile1", "baseAppFile2"]);
    });
});
