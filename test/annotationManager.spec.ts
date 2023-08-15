import * as sinon from "sinon";

import AbapRepoManager from "../src/repositories/abapRepoManager";
import AnnotationManager from "../src/annotationManager"
import BaseAppManager from "../src/baseAppManager";
import { IProjectOptions } from "../src/model/types";
import MockServer from "./util/mockServer";
import { SinonSandbox } from "sinon";
import TestUtil from "./util/testUtil";
import { expect } from "chai";

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

    const expectedAnnotationName1 = TestUtil.getResourceXml("annotationName1-expected.xml")
    const expectedManifest = TestUtil.getResource("manifest-expected-annotations.json");

    it("should process annotations", async () => {
        const abapRepoManager = new AbapRepoManager(options.configuration);
        MockServer.stubAnnotations(sandbox, abapRepoManager);
        const annotationManager = new AnnotationManager(options.configuration, abapRepoManager);
        const getAnnotationI18nsSpy = sandbox.spy(annotationManager, "getAdaptedAnnotation" as any);
        const MANIFEST_FILENAME = "manifest.json";
        const baseAppFiles = new Map<string, string>([[MANIFEST_FILENAME, manifestString]]);
        const renamedFiles = BaseAppManager.renameBaseApp(baseAppFiles, "com.sap.base.app.id", "customer.com.sap.application.variant.id");
        const manifest = JSON.parse(renamedFiles.get(MANIFEST_FILENAME)!);
        const result = await annotationManager.process(manifest, ["EN", "DE", "FR"]);
        expect(getAnnotationI18nsSpy.getCalls().length).to.eql(2);
        expect(getAnnotationI18nsSpy.getCalls()[0].args[0]).to.have.members([
            "edmx:Edmx/edmx:DataServices/Schema/Annotations/2/Annotation/1/_attributes/String/",
            "edmx:Edmx/edmx:DataServices/Schema/Annotations/2/Annotation/1/_attributes/Value/",
            "edmx:Edmx/edmx:DataServices/Schema/Annotations/3/Annotation/_attributes/String/",
            "edmx:Edmx/edmx:DataServices/Schema/Annotations/3/Annotation/_attributes/Value/",
            "edmx:Edmx/edmx:DataServices/Schema/Annotations/0/Annotation/0/_attributes/Qualifier/"
        ]);
        expect(getAnnotationI18nsSpy.getCalls()[1].args[0]).to.have.members([
            "edmx:Edmx/edmx:Include/_attributes/Alias/",
            "edmx:Edmx/edmx:Include/_attributes/Namespace/"
        ]);
        expect(result.get("annotations/annotation_annotationName1.xml")).to.be.eql(expectedAnnotationName1);
        expect(manifest).to.be.eql(JSON.parse(expectedManifest));
        expect([...result.keys()]).to.have.members([
            "annotations/annotation_annotationName1.xml",
            "annotations/annotation_annotationName2.xml",
            "i18n/annotations/customercomsapapplicationvariantid/i18n_en.properties",
            "i18n/annotations/customercomsapapplicationvariantid/i18n_de.properties",
            "i18n/annotations/customercomsapapplicationvariantid/i18n_fr.properties"
        ]);
        expect(getI18ns(result, ["annotations/annotation_annotationName1.xml", "annotations/annotation_annotationName2.xml"])).to.have.members([
            "customer.com.sap.application.variant.id_AIRLINE0=Airline\ncustomer.com.sap.application.variant.id_AIRLINE=Airline\ncustomer.com.sap.application.variant.id_CALCULATETOTALPRICE=calculateTotalPrice\ncustomer.com.sap.application.variant.id_CDS_M2_SD_TRAVEL_MDUU=cds_m2_sd_travel_mduu\ncustomer.com.sap.application.variant.id_CUSTOMER=Customer\ncustomer.com.sap.application.variant.id_CUSTOMER_VALUE_1=Customer Value 1\ncustomer.com.sap.application.variant.id_METADATA=Metadata",
            "customer.com.sap.application.variant.id_AIRLINE0=Fluglinie\ncustomer.com.sap.application.variant.id_AIRLINE=Fluglinie\ncustomer.com.sap.application.variant.id_CALCULATETOTALPRICE=calculateTotalPrice\ncustomer.com.sap.application.variant.id_CDS_M2_SD_TRAVEL_MDUU=cds_m2_sd_reise_mduu\ncustomer.com.sap.application.variant.id_CUSTOMER=Kunde\ncustomer.com.sap.application.variant.id_CUSTOMER_VALUE_1=KundeWert\ncustomer.com.sap.application.variant.id_METADATA=Metadaten",
            "customer.com.sap.application.variant.id_AIRLINE0=Compagnie aérienne\ncustomer.com.sap.application.variant.id_AIRLINE=Compagnie aérienne\ncustomer.com.sap.application.variant.id_CALCULATETOTALPRICE=calculer le prix total\ncustomer.com.sap.application.variant.id_CDS_M2_SD_TRAVEL_MDUU=cds_m2_sd_voyager_mduu\ncustomer.com.sap.application.variant.id_CUSTOMER=Client\ncustomer.com.sap.application.variant.id_CUSTOMER_VALUE_1=Client valeur\ncustomer.com.sap.application.variant.id_METADATA=Metadonnees"
        ]);
    });

    describe("traverse json", () => {
        it("should throw exception when incorrect path", () => {
            expect(() => AnnotationManager.traverseJson({ a: "" }, "a/b")).to.throw("Target property 'b' is undefined in path 'a/b' for { a: '' }");
            expect(() => AnnotationManager.traverseJson({ a: undefined }, "a/b")).to.throw("Property 'a' is undefined in path 'a/b' for { a: undefined }");
            expect(() => AnnotationManager.traverseJson({ a: null }, "a/b")).to.throw("Property 'a' is undefined in path 'a/b' for { a: null }");
            expect(() => AnnotationManager.traverseJson({ a: "" }, "a/b/c")).to.throw("Property 'b' is undefined in path 'a/b/c' for { a: '' }");
            expect(() => AnnotationManager.traverseJson({ a: { c: "" } }, "a/b")).to.throw("Target property 'b' is undefined in path 'a/b' for { a: { c: '' } }");
            expect(() => AnnotationManager.traverseJson({ a: [{}, {}] }, "a/2")).to.throw("Target property '2' is undefined in path 'a/2' for { a: [ {}, {}, [length]: 2 ] }");
            expect(() => AnnotationManager.traverseJson({ a: [{}, {}] }, "a/c")).to.throw("Array index 'c' is not a number in path 'a/c' for { a: [ {}, {}, [length]: 2 ] }");
            expect(() => AnnotationManager.traverseJson({ a: [{ c: "item1" }, {}] }, "a/1/c")).to.throw("Target property 'c' is undefined in path 'a/1/c' for { a: [ { c: 'item1' }, {}, [length]: 2 ] }");
        });
        it("should return correct array element", () => {
            const { subject, property } = AnnotationManager.traverseJson({ a: [{ c: "item1" }, {}] }, "a/0/c");
            expect(property).to.eql("c");
            expect(subject).to.eql({ "c": "item1" });
        });
        it("should return correct path for single element", () => {
            const { subject, property } = AnnotationManager.traverseJson({ a: "item1" }, "a");
            expect(property).to.eql("a");
            expect(subject).to.eql({ "a": "item1" });
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


function getI18ns(files: Map<string, string>, annotationFileNames: string[]) {
    const i18ns: string[] = [];
    files.forEach((value, key) => {
        if (!annotationFileNames.includes(key)) {
            i18ns.push(value);
        }
    });
    return i18ns;
}
