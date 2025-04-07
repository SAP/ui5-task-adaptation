import * as chai from "chai";
import * as sinon from "sinon";

import AbapRepoManager from "../src/repositories/abapRepoManager.js";
import AnnotationManager from "../src/annotationManager.js"
import { IProjectOptions } from "../src/model/types.js";
import Language from "../src/model/language.js";
import RequestUtil from "../src/util/requestUtil.js";
import { SinonSandbox } from "sinon";
import TestUtil from "./testUtilities/testUtil.js";

const { expect } = chai;

describe("AnnotationManager Failed Request", () => {

    let sandbox: SinonSandbox = sinon.createSandbox();
    const options: IProjectOptions = {
        projectNamespace: "ns",
        configuration: {
            destination: "system",
            appName: "appName"
        }
    };

    beforeEach(() => sandbox = sinon.createSandbox());
    afterEach(() => sandbox.restore());

    const manifest = JSON.parse(TestUtil.getResource("manifest.json"));

    it("should throw error when fetching annotation", async () => {
        const abapRepoManager = new AbapRepoManager(options.configuration);
        sandbox.stub(RequestUtil, "get").throws(new Error("Not found"));
        sandbox.stub(RequestUtil, "head").throws(new Error("Not found"));
        const annotationManager = new AnnotationManager(options.configuration, abapRepoManager);
        expect(annotationManager.process(manifest, Language.create(["EN", "DE", "FR"]))).
            to.be.rejectedWith("Failed to fetch annotation by '/sap/opu/odata4/sap/f4_fv_airlines_mduu_04/utyr/sap/f4_sd_airlines_mduu/0001/': Not found");
    });

});
