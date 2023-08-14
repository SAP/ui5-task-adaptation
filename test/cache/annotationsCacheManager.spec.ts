import * as chai from "chai";
import * as sinon from "sinon";

import AbapRepoManager from "../../src/repositories/abapRepoManager";
import AnnotationManager from "../../src/annotationManager";
import AnnotationsCacheManager from "../../src/cache/annotationsCacheManager";
import { IConfiguration } from "../../src/model/types";
import { SinonSandbox } from "sinon";
import TestUtil from "../util/testUtil";

const { expect } = chai;

describe("AnnotationsCacheManager", () => {
    let sandbox: SinonSandbox;
    const configuration: IConfiguration = {
        destination: "abc",
        appName: "appName"
    };

    const cacheManager = new AnnotationsCacheManager(configuration, "annotationName1-EN");
    const manifestAnnotationOnly = TestUtil.getResourceJson("manifest-annotation-only.json");

    beforeEach(async () => sandbox = sinon.createSandbox());
    afterEach(() => {
        sandbox.restore();
        cacheManager.deleteTemp();
    });


    it("should read from temp with the same metadata", async () => {
        const { downloadCalled, promisesPerLanguage } = await prepareTest({ changedOn: "2100.01.01" }, { changedOn: "2100.01.01" });
        expect(downloadCalled).to.be.false;
        expect((await promisesPerLanguage[0])).to.eql({ language: "EN", xml: "content1" });
    });


    it("should download with different metadata", async () => {
        const { downloadCalled, promisesPerLanguage } = await prepareTest({ changedOn: "2100.01.01" }, { changedOn: "2100.01.02" });
        expect(downloadCalled).to.be.true;
        expect((await promisesPerLanguage[0])).to.eql({ language: "EN", xml: "content2" });
    });


    it("should download without temp metadata", async () => {
        const { downloadCalled, promisesPerLanguage } = await prepareTest(undefined, { changedOn: "2100.01.02" });
        expect(downloadCalled).to.be.true;
        expect((await promisesPerLanguage[0])).to.eql({ language: "EN", xml: "content2" });
    });


    async function prepareTest(tempMetadata: any, metadata: any) {
        const abapRepoManager = new AbapRepoManager(configuration);
        sandbox.stub(abapRepoManager, "getAnnotationMetadata").resolves(metadata);

        const downloadAnnotationFileStub = sandbox.stub(abapRepoManager, "downloadAnnotationFile")
            .resolves(new Map([["file1", "content2"]]));
        if (tempMetadata) {
            await cacheManager.writeTemp(new Map([["file1", "content1"]]), tempMetadata);
        }

        const annotationManager = new AnnotationManager(configuration, abapRepoManager);
        const createFilesSpy = sandbox.stub(annotationManager, "createAnnotationFile" as any);
        sandbox.stub(annotationManager, "updateManifest" as any);
        const files = await annotationManager.process(manifestAnnotationOnly, ["EN"]);
        expect([...files.keys()]).to.have.members(["annotations/annotation_annotationName1.xml"]);
        return {
            downloadCalled: downloadAnnotationFileStub.called,
            promisesPerLanguage: createFilesSpy.getCall(0).args[0]
        };
    }

});
