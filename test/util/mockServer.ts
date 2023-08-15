import AbapRepoManager from "../../src/repositories/abapRepoManager";
import { SinonSandbox } from "sinon";
import TestUtil from "./testUtil";

export default class MockServer {

    static stubAnnotations(sandbox: SinonSandbox, abapRepoManager: AbapRepoManager) {
        const annotationsName1 = new Map<string, Map<string, string>>([
            ["", new Map([["annotation.xml", TestUtil.getResource("annotationName1.xml")]])],
            ["EN", new Map([["annotation.xml", TestUtil.getResource("annotationName1-en.xml")]])],
            ["DE", new Map([["annotation.xml", TestUtil.getResource("annotationName1-de.xml")]])],
            ["FR", new Map([["annotation.xml", TestUtil.getResource("annotationName1-fr.xml")]])]
        ]);
        const annotationsName2 = new Map<string, Map<string, string>>([
            ["", new Map([["annotation.xml", TestUtil.getResource("annotationName2.xml")]])],
            ["EN", new Map([["annotation.xml", TestUtil.getResource("annotationName2-en.xml")]])],
            ["DE", new Map([["annotation.xml", TestUtil.getResource("annotationName2-de.xml")]])],
            ["FR", new Map([["annotation.xml", TestUtil.getResource("annotationName2-fr.xml")]])]
        ]);
        const changedOn = new Date().toString();
        sandbox.stub(abapRepoManager, "getAnnotationMetadata" as any)
            .withArgs("https://system.dest/sap/opu/odata4/sap/f4_fv_airlines_mduu_04/utyr/sap/f4_sd_airlines_mduu/0001/").resolves({ changedOn })
            .withArgs("https://system.dest/sap/opu/odata4/sap/f4_fv_airlines_mduu_04/utyr/sap/f4_sd_airlines_mduu/0001/?sap-language=EN").resolves({ changedOn })
            .withArgs("https://system.dest/sap/opu/odata4/sap/f4_fv_airlines_mduu_04/utyr/sap/f4_sd_airlines_mduu/0001/?sap-language=DE").resolves({ changedOn })
            .withArgs("https://system.dest/sap/opu/odata4/sap/f4_fv_airlines_mduu_04/utyr/sap/f4_sd_airlines_mduu/0001/?sap-language=FR").resolves({ changedOn })
            .withArgs("https://system.dest/sap/opu/odata4/sap/f4_fv_airlines_mduu_04/utyr/sap/f4_sd_airlines_mduu/0002/annotation.xml").resolves({ changedOn })
            .withArgs("https://system.dest/sap/opu/odata4/sap/f4_fv_airlines_mduu_04/utyr/sap/f4_sd_airlines_mduu/0002/annotation.xml?sap-language=EN").resolves({ changedOn })
            .withArgs("https://system.dest/sap/opu/odata4/sap/f4_fv_airlines_mduu_04/utyr/sap/f4_sd_airlines_mduu/0002/annotation.xml?sap-language=DE").resolves({ changedOn })
            .withArgs("https://system.dest/sap/opu/odata4/sap/f4_fv_airlines_mduu_04/utyr/sap/f4_sd_airlines_mduu/0002/annotation.xml?sap-language=FR").resolves({ changedOn });
        sandbox.stub(abapRepoManager, "downloadAnnotationFile" as any)
            .withArgs("https://system.dest/sap/opu/odata4/sap/f4_fv_airlines_mduu_04/utyr/sap/f4_sd_airlines_mduu/0001/").resolves(annotationsName1.get(""))
            .withArgs("https://system.dest/sap/opu/odata4/sap/f4_fv_airlines_mduu_04/utyr/sap/f4_sd_airlines_mduu/0001/?sap-language=EN").resolves(annotationsName1.get("EN"))
            .withArgs("https://system.dest/sap/opu/odata4/sap/f4_fv_airlines_mduu_04/utyr/sap/f4_sd_airlines_mduu/0001/?sap-language=DE").resolves(annotationsName1.get("DE"))
            .withArgs("https://system.dest/sap/opu/odata4/sap/f4_fv_airlines_mduu_04/utyr/sap/f4_sd_airlines_mduu/0001/?sap-language=FR").resolves(annotationsName1.get("FR"))
            .withArgs("https://system.dest/sap/opu/odata4/sap/f4_fv_airlines_mduu_04/utyr/sap/f4_sd_airlines_mduu/0002/annotation.xml").resolves(annotationsName2.get(""))
            .withArgs("https://system.dest/sap/opu/odata4/sap/f4_fv_airlines_mduu_04/utyr/sap/f4_sd_airlines_mduu/0002/annotation.xml?sap-language=EN").resolves(annotationsName2.get("EN"))
            .withArgs("https://system.dest/sap/opu/odata4/sap/f4_fv_airlines_mduu_04/utyr/sap/f4_sd_airlines_mduu/0002/annotation.xml?sap-language=DE").resolves(annotationsName2.get("DE"))
            .withArgs("https://system.dest/sap/opu/odata4/sap/f4_fv_airlines_mduu_04/utyr/sap/f4_sd_airlines_mduu/0002/annotation.xml?sap-language=FR").resolves(annotationsName2.get("FR"));
    }

}