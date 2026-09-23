import * as chai from "chai";
import * as sinon from "sinon";

import AbapRepository from "../../src/repositories/abapRepository.js";
import { IProjectOptions } from "../../src/model/types.js";
import RequestUtil from "../../src/util/requestUtil.js";
import { SinonSandbox } from "sinon";
import TestUtil from "./testUtilities/testUtil.js";
import DownloadAnnotationsCommand from "../../src/adapters/commands/downloadAnnotationsCommand.js";
import { stringToBuffer } from "../../src/util/commonUtil.js";

const { expect } = chai;

describe("AnnotationManager Failed Request", () => {

    let sandbox: SinonSandbox = sinon.createSandbox();
    const options: IProjectOptions = {
        projectNamespace: "ns",
        configuration: {
            destination: "system",
            appName: "appName",
            languages: ["EN", "DE", "FR"]
        }
    };

    beforeEach(() => sandbox = sinon.createSandbox());
    afterEach(() => sandbox.restore());

    const manifest = JSON.parse(TestUtil.getResource("manifest.json"));

    it("should throw error when fetching annotation", async () => {
        const abapRepository = new AbapRepository(options.configuration);
        sandbox.stub(RequestUtil, "get").throws(new Error("Not found"));
        sandbox.stub(RequestUtil, "head").throws(new Error("Not found"));
        const annotationManager = new DownloadAnnotationsCommand("appVarId", "prefix", options.configuration, abapRepository);
        const files = new Map<string, Buffer>([["manifest.json", stringToBuffer(JSON.stringify(manifest))]]);
        expect(annotationManager.execute(files, "manifest.json")).
            to.be.rejectedWith("Failed to fetch annotation by '/sap/opu/odata4/sap/f4_fv_airlines_mduu_04/utyr/sap/f4_sd_airlines_mduu/0001/': Not found");
    });

});
