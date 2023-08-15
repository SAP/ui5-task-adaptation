import * as sinon from "sinon";

import AbapRepoManager from "../src/repositories/abapRepoManager";
import AnnotationManager from "../src/annotationManager"
import { IProjectOptions } from "../src/model/types";
import RequestUtil from "../src/util/requestUtil";
import { SinonSandbox } from "sinon";
import TestUtil from "./util/testUtil";
import { expect } from "chai";

describe("AnnotationManager Failed Request", () => {

    let sandbox: SinonSandbox = sinon.createSandbox();
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

    beforeEach(() => sandbox = sinon.createSandbox());
    afterEach(() => sandbox.restore());

    const manifest = JSON.parse(TestUtil.getResource("manifest.json"));

    it("should throw error when fetching annotation", async () => {
        const abapRepoManager = new AbapRepoManager(options.configuration);
        sandbox.stub(RequestUtil, "get").throws(new Error("Not found"));
        sandbox.stub(RequestUtil, "head").throws(new Error("Not found"));
        const annotationManager = new AnnotationManager(options.configuration, abapRepoManager);
        await expect(annotationManager.process(manifest, ["EN", "DE", "FR"]))
            .to.be.rejectedWith("Failed to fetch annotation 'annotationName1' by 'https://system.dest/sap/opu/odata4/sap/f4_fv_airlines_mduu_04/utyr/sap/f4_sd_airlines_mduu/0001/?sap-language=EN'");
    });

});
