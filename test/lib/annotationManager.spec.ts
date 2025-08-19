import * as fs from "fs";
import * as sinon from "sinon";

import { expect } from "chai";

import AbapRepoManager from "../../src/repositories/abapRepoManager.js";
import AnnotationManager from "../../src/annotationManager.js";
import { IProjectOptions } from "../../src/model/types.js";
import Language from "../../src/model/language.js";
import MockServer from "./testUtilities/mockServer.js";
import { SinonSandbox } from "sinon";
import TestUtil from "./testUtilities/testUtil.js";
import { renameResources } from "../../src/util/renamingUtil.js";

let sandbox: SinonSandbox = sinon.createSandbox();
const options: IProjectOptions = {
    projectNamespace: "ns",
    configuration: {
        destination: "system",
        appName: "appName",
        enableBetaFeatures: true
    }
};
const manifestString = TestUtil.getResource("manifest.json");

describe("AnnotationManager", () => {

    beforeEach(() => sandbox = sinon.createSandbox());
    afterEach(() => sandbox.restore());

    const expectedAnnotationName1 = TestUtil.getResourceXml("annotations/v2/annotation-1-v2-expected/annotationName1-expected.xml");
    const expectedAnnotationName1WithoutI18NModel = TestUtil.getResourceXml("annotations/v2/annotation-1-v2-expected/annotationName1WithoutI18NModel-expected.xml");
    const expectedManifest = TestUtil.getResource("manifest-expected-annotations.json");
    const expectedManifestForOneLanguage = TestUtil.getResource("manifest-expected-annotations-one-langauge.json");

    it("should process annotations", async () => {
        const abapRepoManager = new AbapRepoManager(options.configuration);
        stubAnnotations(abapRepoManager);
        const annotationManager = new AnnotationManager(options.configuration, abapRepoManager);
        const MANIFEST_FILENAME = "manifest.json";
        const baseAppFiles = new Map<string, string>([[MANIFEST_FILENAME, manifestString]]);
        const renamedFiles = renameResources(baseAppFiles, ["com.sap.base.app.id"], "customer.com.sap.application.variant.id");
        const manifest = JSON.parse(renamedFiles.get(MANIFEST_FILENAME)!);
        const result = await annotationManager.process(manifest, Language.create(["EN", "DE", "FR"]), "customer.com.sap.application.variant.id", "customer_com_sap_application_variant_id");
        expect(result.get("annotations/annotation_annotationName1.xml")).to.be.eql(expectedAnnotationName1);
        expect(manifest).to.be.eql(JSON.parse(expectedManifest));
        expect([...result.keys()]).to.have.members([
            "annotations/annotation_annotationName1.xml",
            "annotations/annotation_annotationName2.xml",
            "customer_com_sap_application_variant_id/i18n/annotations/i18n.properties",
            "customer_com_sap_application_variant_id/i18n/annotations/i18n_en.properties",
            "customer_com_sap_application_variant_id/i18n/annotations/i18n_de.properties",
            "customer_com_sap_application_variant_id/i18n/annotations/i18n_fr.properties"
        ]);
        expect(getI18ns(result, "i18n_en")).to.have.members([
            "customer.com.sap.application.variant.id_AIRLINE=Airline",
            "customer.com.sap.application.variant.id_AIRLINE0=Airline",
            "customer.com.sap.application.variant.id_CUSTOMER=Customer",
            "customer.com.sap.application.variant.id_CUSTOMER_VALUE_1=Customer Value 1",
            "customer.com.sap.application.variant.id_CURRENCY=currency",
            "customer.com.sap.application.variant.id_CALCULATETOTALPRICE=calculateTotalPrice",
            "customer.com.sap.application.variant.id_METADATA=Metadata",
            "customer.com.sap.application.variant.id_CDS_M2_SD_TRAVEL_MDUU=cds_m2_sd_travel_mduu",
            "customer.com.sap.application.variant.id_CURRENCY0=currency"
        ]);
        expect(getI18ns(result, "i18n_de")).to.have.members([
            "customer.com.sap.application.variant.id_AIRLINE=Fluglinie",
            "customer.com.sap.application.variant.id_AIRLINE0=Fluglinie",
            "customer.com.sap.application.variant.id_CUSTOMER=Kunde",
            "customer.com.sap.application.variant.id_CUSTOMER_VALUE_1=KundeWert",
            "customer.com.sap.application.variant.id_CURRENCY=währung",
            "customer.com.sap.application.variant.id_CALCULATETOTALPRICE=calculateTotalPrice",
            "customer.com.sap.application.variant.id_METADATA=Metadaten",
            "customer.com.sap.application.variant.id_CDS_M2_SD_TRAVEL_MDUU=cds_m2_sd_reise_mduu",
            "customer.com.sap.application.variant.id_CURRENCY0=währung"
        ]);
        expect(getI18ns(result, "i18n_fr")).to.have.members([
            "customer.com.sap.application.variant.id_AIRLINE=Compagnie aérienne",
            "customer.com.sap.application.variant.id_AIRLINE0=Compagnie aérienne",
            "customer.com.sap.application.variant.id_CUSTOMER=Client",
            "customer.com.sap.application.variant.id_CUSTOMER_VALUE_1=Client valeur",
            "customer.com.sap.application.variant.id_CURRENCY=monnaie",
            "customer.com.sap.application.variant.id_CALCULATETOTALPRICE=calculer le prix total",
            "customer.com.sap.application.variant.id_METADATA=Metadonnees",
            "customer.com.sap.application.variant.id_CDS_M2_SD_TRAVEL_MDUU=cds_m2_sd_voyager_mduu",
            "customer.com.sap.application.variant.id_CURRENCY0=monnaie"
        ]);

        it("should process annotations without enhancing @i18n model if only one language is active", async () => {
            const abapRepoManager = new AbapRepoManager(options.configuration);
            stubAnnotations(abapRepoManager);
            const annotationManager = new AnnotationManager(options.configuration, abapRepoManager);
            const getAnnotationI18nsSpy = sandbox.spy(annotationManager, "getAdaptedAnnotation" as any);
            const MANIFEST_FILENAME = "manifest.json";
            const baseAppFiles = new Map<string, string>([[MANIFEST_FILENAME, manifestString]]);
            const renamedFiles = renameResources(baseAppFiles, ["com.sap.base.app.id"], "customer.com.sap.application.variant.id");
            const manifest = JSON.parse(renamedFiles.get(MANIFEST_FILENAME)!);
            const result = await annotationManager.process(manifest, Language.create(["EN"]), "customer.com.sap.application.variant.id", "customer_com_sap_application_variant_id");
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
        stubAnnotations(abapRepoManager);

        it("should create sap.ui5 and new model", async () => await processManifest({
            // sap.ui5 doesn't exist
        }, {
            "sap.ui5": {
                models: {
                    "@i18n": {
                        type: "sap.ui.model.resource.ResourceModel",
                        uri: "customer_com_sap_application_variant_id/i18n/annotations/i18n.properties"
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
                        uri: "customer_com_sap_application_variant_id/i18n/annotations/i18n.properties"
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
                        uri: "i18n/annotations/baseapp1/i18n.properties"
                    }
                }
            }
        }, {
            "sap.ui5": {
                models: {
                    "@i18n": {
                        type: "sap.ui.model.resource.ResourceModel",
                        uri: "i18n/annotations/baseapp1/i18n.properties",
                        "settings": {
                            "enhanceWith": [
                                {
                                    "bundleUrl": "customer_com_sap_application_variant_id/i18n/annotations/i18n.properties",
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
                id: "base.app1"
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
            await annotationManager.process(actual, Language.create(["EN", "DE", "FR"]), "customer.com.sap.application.variant.id", "customer_com_sap_application_variant_id");
            expect(actual).to.be.eql({ ...sapAppExpected, ...expectedSapUi5 });
        }
    });

    describe("ODataV4", () => {
        it("should convert v2 to v4 and extract translations", async () => await processAnnotations("annotations/v2/metadata-v2"));
        it("should process xml with missing annotation terms", async () => await processAnnotations("annotations/v4/metadata-v4"));
        it("should extract translations (download content)", async () => await processAnnotations("metadata/download/mainService", ["ZH", "TH", "KO", "RO", "SL", "HR", "MS", "UK", "AR", "HE", "CS", "DE", "EN", "FR", "EL", "HU", "IT", "JA", "DA", "PL", "ZF", "NL", "NO", "PT", "SK", "RU", "ES", "TR", "FI", "SV", "BG", "SH", "KK"]));
    });

    describe("Download Annotation files with failed requests and retry", () => {
        const LANGUAGES = ["DE", "EN"];
        it("should retry to download annotation file after first request failed", async () => {
            const REQUESTS_TO_FAIL = 1;
            const EXPECTED_TRIES = 2;
            await processAnnotations("annotations/v2/metadata-v2", LANGUAGES, LANGUAGES.length * EXPECTED_TRIES, REQUESTS_TO_FAIL);
        });
        it("should throw error after configured max 2 requests failed", async () => {
            const REQUESTS_TO_FAIL = 2;
            const EXPECTED_TRIES = 3;
            await expect(processAnnotations("annotations/v2/metadata-v2", LANGUAGES, LANGUAGES.length * EXPECTED_TRIES, REQUESTS_TO_FAIL)).to.be
                .rejectedWith("Error occurred: Request /sap/opu/odata4/m2_sd_travel_mduu/$metadata failed with Server error: 500. Please try again if this is a temporary issue. If not, please create a ticket on CA-UI5-ABA-AIDX");
        });
    });
});

async function processAnnotations(folder: string, languages = ["EN", "DE"], expectedDownloadRequests?: number, numberOfFailedRequests?: number) {
    if (!fs.existsSync(TestUtil.getResourcePath(folder))) {
        return;
    }
    const abapRepoManager = new AbapRepoManager(options.configuration);
    const ODATA_URI = "/sap/opu/odata4/m2_sd_travel_mduu/";
    const stub = MockServer.stubAnnotations(sandbox, abapRepoManager, [{ folder, url: ODATA_URI + "$metadata" }], numberOfFailedRequests);
    const annotationManager = new AnnotationManager(options.configuration, abapRepoManager);
    const MANIFEST_FILENAME = "manifest.json";
    const baseAppFiles = new Map<string, string>([[MANIFEST_FILENAME, JSON.stringify({
        "sap.app": {
            "id": "com.sap.base.app.id",
            "i18n": "i18n/i18n.properties",
            "applicationVersion": {
                "version": "1.0.0"
            },
            "dataSources": {
                "mainService": {
                    "uri": ODATA_URI,
                    "type": "OData"
                }
            }
        }
    })]]);
    const renamedFiles = renameResources(baseAppFiles, ["com.sap.base.app.id"], "customer.com.sap.application.variant.id");
    const manifest = JSON.parse(renamedFiles.get(MANIFEST_FILENAME)!);
    const result = await annotationManager.process(manifest, Language.create(languages), "customer.com.sap.application.variant.id", "customer_com_sap_application_variant_id");
    const expectedFolder = `${folder}-expected/metadata.xml`;
    if (fs.existsSync(TestUtil.getResourcePath(expectedFolder))) {
        const expected = TestUtil.getResourceXml(expectedFolder);
        expect(TestUtil.normalizeXml(result.get("annotations/annotation_mainService.xml")!)).to.be.eql(expected);
        expect([...result.keys()]).to.have.members([
            "annotations/annotation_mainService.xml",
            "customer_com_sap_application_variant_id/i18n/annotations/i18n.properties",
            "customer_com_sap_application_variant_id/i18n/annotations/i18n_en.properties",
            "customer_com_sap_application_variant_id/i18n/annotations/i18n_de.properties",
        ]);
    }
    if (expectedDownloadRequests) {
        expect(stub.callCount).to.eq(expectedDownloadRequests);
    }
}

function getI18ns(files: Map<string, string>, fileName: string) {
    return files.get(`customer_com_sap_application_variant_id/i18n/annotations/${fileName}.properties`)!.split("\n");
}

function stubAnnotations(abapRepoManager: AbapRepoManager) {
    MockServer.stubAnnotations(sandbox, abapRepoManager, [
        {
            folder: "annotations/v2/annotation-1-v2",
            url: "/sap/opu/odata4/sap/f4_fv_airlines_mduu_04/utyr/sap/f4_sd_airlines_mduu/0001/"
        },
        {
            folder: "annotations/v2/annotation-2-v2",
            url: "/sap/opu/odata4/sap/f4_fv_airlines_mduu_04/utyr/sap/f4_sd_airlines_mduu/0002/annotation.xml"
        },
        {
            folder: "annotations/v2/annotation-3-v2-child",
            url: "/sap/opu/odata/sap/M2_SB_TRAVEL_MDUU_02/$metadata"
        },
        {
            folder: "annotations/v2/annotation-3-v2-child",
            url: "/sap/opu/odata/sap/M2_SB_TRAVEL_MDUU_02/$metadata"
        }
    ]);
}
