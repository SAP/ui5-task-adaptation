import * as sinon from "sinon";

import AbapRepoManager from "../src/repositories/abapRepoManager";
import AnnotationManager from "../src/annotationManager";
import { IProjectOptions } from "../src/model/types";
import MockServer from "./testUtilities/mockServer";
import { SinonSandbox } from "sinon";
import TestUtil from "./testUtilities/testUtil";
import { expect } from "chai";
import { renameResources } from "../src/util/commonUtil";

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
const manifestString = TestUtil.getResource("manifest.json");

describe("AnnotationManager", () => {

    beforeEach(() => sandbox = sinon.createSandbox());
    afterEach(() => sandbox.restore());

    const expectedAnnotationName1 = TestUtil.getResourceXml("annotationName1-expected.xml");
    const expectedAnnotationName1WithoutI18NModel = TestUtil.getResourceXml("annotationName1WithoutI18NModel-expected.xml");
    const expectedManifest = TestUtil.getResource("manifest-expected-annotations.json");
    const expectedManifestForOneLanguage = TestUtil.getResource("manifest-expected-annotations-one-langauge.json");

    it("should process annotations", async () => {
        const abapRepoManager = new AbapRepoManager(options.configuration);
        MockServer.stubAnnotations(sandbox, abapRepoManager);
        const annotationManager = new AnnotationManager(options.configuration, abapRepoManager);
        const MANIFEST_FILENAME = "manifest.json";
        const baseAppFiles = new Map<string, string>([[MANIFEST_FILENAME, manifestString]]);
        const renamedFiles = renameResources(baseAppFiles, "com.sap.base.app.id", "customer.com.sap.application.variant.id");
        const manifest = JSON.parse(renamedFiles.get(MANIFEST_FILENAME)!);
        const result = await annotationManager.process(manifest, ["EN", "DE", "FR"]);
        expect(result.get("annotations/annotation_annotationName1.xml")).to.be.eql(expectedAnnotationName1);
        expect(manifest).to.be.eql(JSON.parse(expectedManifest));
        expect([...result.keys()]).to.have.members([
            "annotations/annotation_annotationName1.xml",
            "annotations/annotation_annotationName2.xml",
            "i18n/annotations/customercomsapapplicationvariantid/i18n_en.properties",
            "i18n/annotations/customercomsapapplicationvariantid/i18n_de.properties",
            "i18n/annotations/customercomsapapplicationvariantid/i18n_fr.properties"
        ]);
        expect(getI18ns(result, "i18n_en")).to.have.members([
            "customer.com.sap.application.variant.id_AIRLINE=Airline",
            "customer.com.sap.application.variant.id_AIRLINE0=Airline",
            "customer.com.sap.application.variant.id_CUSTOMER=Customer",
            "customer.com.sap.application.variant.id_CUSTOMER_VALUE_1=Customer Value 1",
            "customer.com.sap.application.variant.id_CALCULATETOTALPRICE=calculateTotalPrice",
            "customer.com.sap.application.variant.id_METADATA=Metadata",
            "customer.com.sap.application.variant.id_CDS_M2_SD_TRAVEL_MDUU=cds_m2_sd_travel_mduu"
        ]);
        expect(getI18ns(result, "i18n_de")).to.have.members([
            "customer.com.sap.application.variant.id_AIRLINE=Fluglinie",
            "customer.com.sap.application.variant.id_AIRLINE0=Fluglinie",
            "customer.com.sap.application.variant.id_CUSTOMER=Kunde",
            "customer.com.sap.application.variant.id_CUSTOMER_VALUE_1=KundeWert",
            "customer.com.sap.application.variant.id_CALCULATETOTALPRICE=calculateTotalPrice",
            "customer.com.sap.application.variant.id_METADATA=Metadaten",
            "customer.com.sap.application.variant.id_CDS_M2_SD_TRAVEL_MDUU=cds_m2_sd_reise_mduu"
        ]);
        expect(getI18ns(result, "i18n_fr")).to.have.members([
            "customer.com.sap.application.variant.id_AIRLINE=Compagnie aérienne",
            "customer.com.sap.application.variant.id_AIRLINE0=Compagnie aérienne",
            "customer.com.sap.application.variant.id_CUSTOMER=Client",
            "customer.com.sap.application.variant.id_CUSTOMER_VALUE_1=Client valeur",
            "customer.com.sap.application.variant.id_CALCULATETOTALPRICE=calculer le prix total",
            "customer.com.sap.application.variant.id_METADATA=Metadonnees",
            "customer.com.sap.application.variant.id_CDS_M2_SD_TRAVEL_MDUU=cds_m2_sd_voyager_mduu"
        ]);
    
    it("should process annotations without enhancing @i18n model if only one language is active", async () => {
        const abapRepoManager = new AbapRepoManager(options.configuration);
        MockServer.stubAnnotations(sandbox, abapRepoManager);
        const annotationManager = new AnnotationManager(options.configuration, abapRepoManager);
        const getAnnotationI18nsSpy = sandbox.spy(annotationManager, "getAdaptedAnnotation" as any);
        const MANIFEST_FILENAME = "manifest.json";
        const baseAppFiles = new Map<string, string>([[MANIFEST_FILENAME, manifestString]]);
        const renamedFiles = renameResources(baseAppFiles, "com.sap.base.app.id", "customer.com.sap.application.variant.id");
        const manifest = JSON.parse(renamedFiles.get(MANIFEST_FILENAME)!);
        const result = await annotationManager.process(manifest, ["EN"]);
        expect(getAnnotationI18nsSpy.getCalls().length).to.eql(0);
        expect(result.get("annotations/annotation_annotationName1.xml")).to.be.eql(expectedAnnotationName1WithoutI18NModel);
        expect(manifest).to.be.eql(JSON.parse(expectedManifestForOneLanguage));
        expect([...result.keys()]).to.have.members([
            "annotations/annotation_annotationName1.xml",
            "annotations/annotation_annotationName2.xml",
        ]);
    });
    });

    describe("when updating @i18n model", () => {
        const abapRepoManager = new AbapRepoManager(options.configuration);
        MockServer.stubAnnotations(sandbox, abapRepoManager);

        it("should create sap.ui5 and new model", async () => await processManifest({
            // sap.ui5 doesn't exist
        }, {
            "sap.ui5": {
                models: {
                    "@i18n": {
                        type: "sap.ui.model.resource.ResourceModel",
                        uri: "i18n/annotations/app1/i18n.properties"
                    }
                }
            }
        }));

        it("should create new model", async () => await processManifest({
            "sap.ui5": {
                models: {
                    "i18n": {
                        type: "sap.ui.model.resource.ResourceModel",
                        uri: "i18n/i18n.properties"
                    }
                }
            }
        }, {
            "sap.ui5": {
                models: {
                    "@i18n": {
                        type: "sap.ui.model.resource.ResourceModel",
                        uri: "i18n/annotations/app1/i18n.properties"
                    },
                    "i18n": {
                        type: "sap.ui.model.resource.ResourceModel",
                        uri: "i18n/i18n.properties"
                    }
                }
            }
        }));

        it("should enhance existing model", async () => await processManifest({
            "sap.ui5": {
                models: {
                    "@i18n": {
                        type: "sap.ui.model.resource.ResourceModel",
                        uri: "i18n/annotations/app1/i18n.properties"
                    }
                }
            }
        }, {
            "sap.ui5": {
                models: {
                    "@i18n": {
                        type: "sap.ui.model.resource.ResourceModel",
                        uri: "i18n/annotations/app1/i18n.properties",
                        "settings": {
                            "enhanceWith": [
                                {
                                    "bundleUrl": "i18n/annotations/app1/i18n.properties",
                                    "bundleUrlRelativeTo": "component"
                                }
                            ]
                        }
                    }
                }
            }
        }));

        const processManifest = async (sapUi5: any, expectedSapUi5: any) => {
            const idVersion = {
                applicationVersion: {
                    version: "1.0.0"
                },
                id: "app1"
            }
            const sapAppExpected = {
                "sap.app": {
                    ...idVersion,
                    dataSources: {
                        annotationName1: {
                            type: "ODataAnnotation",
                            uri: "annotations/annotation_annotationName1.xml"
                        }
                    }
                }
            };
            const sapAppActual = {
                "sap.app": {
                    ...idVersion,
                    dataSources: {
                        annotationName1: {
                            type: "ODataAnnotation",
                            uri: "/sap/opu/odata4/sap/f4_fv_airlines_mduu_04/utyr/sap/f4_sd_airlines_mduu/0001/"
                        }
                    }
                }
            };
            const actual = { ...sapAppActual, ...sapUi5 };
            const annotationManager = new AnnotationManager(options.configuration, abapRepoManager);
            await annotationManager.process(actual, ["EN", "DE", "FR"]);
            expect(actual).to.be.eql({ ...sapAppExpected, ...expectedSapUi5 });
        }
    });
});

function getI18ns(files: Map<string, string>, fileName: string) {
    return files.get(`i18n/annotations/customercomsapapplicationvariantid/${fileName}.properties`)!.split("\n");
}
