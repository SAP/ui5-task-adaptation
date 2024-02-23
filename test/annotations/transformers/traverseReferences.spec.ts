import * as sinon from "sinon";

import { IConfiguration, IProjectOptions } from "../../../src/model/types";
import TestUtil, { metadataV4Xml } from "../../testUtilities/testUtil";

import AbapRepoManager from "../../../src/repositories/abapRepoManager";
import DataSourceManager from "../../../src/annotations/dataSource/dataSourceManager";
import I18nManager from "../../../src/i18nManager";
import Language from "../../../src/model/language";
import ServiceRequestor from "../../../src/annotations/serviceRequestor";
import { SinonSandbox } from "sinon";
import { expect } from "chai";

describe("TraverseReferences", () => {

    const options: IProjectOptions = {
        projectNamespace: "ns",
        configuration: {
            type: "abap",
            appName: "appName",
            destination: "system",
            languages: ["", "DE"]
        }
    };

    let sandbox: SinonSandbox;
    const abapRepoManager = new AbapRepoManager(options.configuration);
    const dataSources = {
        "mainService": {
            "uri": "/odata/v2/ManifestConfigurationService",
            "type": "OData"
        }
    };

    beforeEach(async () => sandbox = sinon.createSandbox());
    afterEach(() => sandbox.restore());

    it("should traverse OData with flag enabled", async () => await testTraverseAndFeatureFlag(true, true, 1));
    it("should not process OData with flag disabled", async () => await testTraverseAndFeatureFlag(false, true, 0));
    it("should traverse ODataAnnotation with flag enabled", async () => await testTraverseAndFeatureFlag(true, false, 1));
    it("should not traverse ODataAnnotation with flag disabled", async () => await testTraverseAndFeatureFlag(false, false, 1));

    it("should merge referenced annotations with same targets (single annotation)", async () => {
        const parent = metadataV4Xml(
            `<edmx:Reference Uri="../reference/to/child1">
                <edmx:Include Namespace="CHILD_NAMESPACE" Alias="Child" />
            </edmx:Reference>`,
            `<Annotations Target="SAP__core.SameTarget">
                <Annotation Term="SAP__core.ShouldRemain" />
            </Annotations>`);
        const child = metadataV4Xml(
            `<edmx:Reference Uri="../reference/to/be/ignored">
                <edmx:Include Namespace="com.sap.vocabularies.IgnoredNamespace.v1" Alias="Ignored" />
            </edmx:Reference>`,
            `<Annotations Target="SAP__core.SameTarget">
                <Annotation Term="SAP__core.ShouldBeMerged" />
            </Annotations>`);
        const { files } = createAnnotationFiles(sandbox, dataSources, [
            { xml: child, uri: "/odata/v2/reference/to/child1", name: "CHILD_NAMESPACE" },
            { xml: parent, uri: "/odata/v2/ManifestConfigurationService/$metadata", name: "mainService" }
        ], { enableBetaFeatures: true });
        expect((await files).get("annotations/annotation_mainService.xml")).to.eql(metadataV4Xml(
            `<edmx:Reference Uri="../reference/to/child1">
        <edmx:Include Namespace="CHILD_NAMESPACE" Alias="Child"/>
    </edmx:Reference>
    <edmx:Reference Uri="/odata/v2/ManifestConfigurationService/$metadata">
        <edmx:Include Namespace="com.sap.self" Alias="SAP__self"/>
    </edmx:Reference>`,
            `<Annotations Target="SAP__core.SameTarget" xmlns="http://docs.oasis-open.org/odata/ns/edm">
                <Annotation Term="SAP__core.ShouldRemain"/>
                <Annotation Term="SAP__core.ShouldBeMerged"/>
            </Annotations>`,
            `<Schema Namespace="com.sap.self.bb5">`));
    });

    it("should merge referenced annotations with same targets (multiple annotation)", async () => {
        const parent = metadataV4Xml(
            `<edmx:Reference Uri="../reference/to/child1">
                <edmx:Include Namespace="CHILD_NAMESPACE" Alias="Child" />
            </edmx:Reference>`,
            `<Annotations Target="SAP__core.SameTarget">
                <Annotation Term="SAP__core.SameTerm" Qualifier="ShouldStay"/>
                <Annotation Term="SAP__core.ShouldRemain" />
            </Annotations>`);
        const child = metadataV4Xml(
            `<edmx:Reference Uri="../reference/to/be/ignored">
                <edmx:Include Namespace="com.sap.vocabularies.IgnoredNamespace.v1" Alias="Ignored" />
            </edmx:Reference>`,
            `<Annotations Target="SAP__core.SameTarget">
                <Annotation Term="SAP__core.SameTerm" Qualifier="ShouldNotOverwrite" />
                <Annotation Term="SAP__core.ShouldBeMerged" />
            </Annotations>`);
        const { files } = createAnnotationFiles(sandbox, dataSources, [
            { xml: child, uri: "/odata/v2/reference/to/child1", name: "CHILD_NAMESPACE" },
            { xml: parent, uri: "/odata/v2/ManifestConfigurationService/$metadata", name: "mainService" }
        ], { enableBetaFeatures: true });
        expect((await files).get("annotations/annotation_mainService.xml")).to.eql(metadataV4Xml(
            `<edmx:Reference Uri="../reference/to/child1">
        <edmx:Include Namespace="CHILD_NAMESPACE" Alias="Child"/>
    </edmx:Reference>
    <edmx:Reference Uri="/odata/v2/ManifestConfigurationService/$metadata">
        <edmx:Include Namespace="com.sap.self" Alias="SAP__self"/>
    </edmx:Reference>`,
            `<Annotations Target="SAP__core.SameTarget" xmlns="http://docs.oasis-open.org/odata/ns/edm">
                <Annotation Term="SAP__core.SameTerm" Qualifier="ShouldStay"/>
                <Annotation Term="SAP__core.ShouldRemain"/>
                <Annotation Term="SAP__core.ShouldBeMerged"/>
            </Annotations>`,
            `<Schema Namespace="com.sap.self.bb5">`));
    });

    it("should add referenced annotations with different targets", async () => {
        const odata = metadataV4Xml(
            `<edmx:Reference Uri="../reference/to/child1">
                <edmx:Include Namespace="CHILD_NAMESPACE" Alias="Child" />
            </edmx:Reference>`,
            `<Annotations Target="SAP__core.ShouldRemain">
                <Annotation Term="SAP__core.Computed" />
            </Annotations>`);
        const child = metadataV4Xml(
            `<edmx:Reference Uri="../reference/to/be/ignored">
                <edmx:Include Namespace="com.sap.vocabularies.IgnoredNamespace.v1" Alias="Ignored" />
            </edmx:Reference>`,
            `<Annotations Target="SAP__core.ShouldBeMerged">
                <Annotation Term="SAP__core.Currency" />
            </Annotations>`);
        const { files } = createAnnotationFiles(sandbox, dataSources, [
            { xml: child, uri: "/odata/v2/reference/to/child1", name: "CHILD_NAMESPACE" },
            { xml: odata, uri: "/odata/v2/ManifestConfigurationService/$metadata", name: "mainService" }
        ], { enableBetaFeatures: true });
        expect((await files).get("annotations/annotation_mainService.xml")).to.eql(metadataV4Xml(
            `<edmx:Reference Uri="../reference/to/child1">
        <edmx:Include Namespace="CHILD_NAMESPACE" Alias="Child"/>
    </edmx:Reference>
    <edmx:Reference Uri="/odata/v2/ManifestConfigurationService/$metadata">
        <edmx:Include Namespace="com.sap.self" Alias="SAP__self"/>
    </edmx:Reference>`,
            `<Annotations Target="SAP__core.ShouldRemain" xmlns="http://docs.oasis-open.org/odata/ns/edm">
                <Annotation Term="SAP__core.Computed"/>
            </Annotations>
            <Annotations Target="SAP__core.ShouldBeMerged" xmlns="http://docs.oasis-open.org/odata/ns/edm">
                <Annotation Term="SAP__core.Currency"/>
            </Annotations>`,
            `<Schema Namespace="com.sap.self.bb5">`));
    });

    it("should not traverse metadata reference with relative url", async () => {
        await testTraverseMetadataUrl("/odata/v2/MANIFESTCONFIGURATIONSERVICE/$metadata");
    });
    it("should not traverse metadata reference with absolute url", async () => {
        await testTraverseMetadataUrl("https://sap.com:443/odata/v2/MANIFESTCONFIGURATIONSERVICE/$metadata");
    });


    it("shouldn't do anything since feature flag disabled", async () => {
        const { files } = createAnnotationFiles(sandbox, dataSources, [], {});
        expect((await files).has("annotations/annotation_mainService.xml")).to.be.false;
    });

    async function testTraverseAndFeatureFlag(enableBetaFeatures: boolean, isOData: boolean, filesCount: number) {
        const PARENT_NAME = "mainService";
        const PARENT_URL = "/odata/v2/ManifestConfigurationService/";
        const PARENT_FOLDER = "annotations/v4/metadata-2-v4/";
        const CHILD1_NAME = "FCO_WORKCENTER_COST_SRV";
        const CHILD1_URL = "/sap/fco_workcenter_cost_srv/$metadata";
        const CHILD1_FOLDER = "annotations/v4/metadata-2-child1-v4/";
        const CHILD2_NAME = "FCO_WORKCENTER_COST_SRV_2";
        const CHILD2_URL = "/sap/opu/odata/sap/fco_workcenter_cost_srv_2/$metadata";
        const CHILD2_FOLDER = "annotations/v4/metadata-2-child2-v4/";

        const dataSourceManager = new DataSourceManager();
        dataSourceManager.addDataSources({
            [PARENT_NAME]: {
                "uri": PARENT_URL,
                "type": isOData ? "OData" : "ODataAnnotation"
            }
        }, { enableBetaFeatures });
        const languages = Language.create(["DE"]);
        const i18nManager = new I18nManager("model1", "appVariantId1", languages);
        const serviceRequestor = new ServiceRequestor(options.configuration, abapRepoManager);
        sandbox.stub(serviceRequestor, "downloadAnnotation")
            // level 0
            .withArgs(PARENT_URL + (isOData ? "$metadata" : ""), PARENT_NAME, languages.find(l => l.isDefault))
            .resolves(TestUtil.getResourceXml(PARENT_FOLDER + "metadata-en.xml"))
            .withArgs(PARENT_URL + (isOData ? "$metadata" : ""), PARENT_NAME, languages.find(l => l.sap === "DE"))
            .resolves(TestUtil.getResourceXml(PARENT_FOLDER + "metadata-de.xml"))
            // level -1
            .withArgs(CHILD1_URL, CHILD1_NAME, languages.find(l => l.isDefault))
            .resolves(TestUtil.getResourceXml(CHILD1_FOLDER + "metadata-en.xml"))
            .withArgs(CHILD1_URL, CHILD1_NAME, languages.find(l => l.sap === "DE"))
            .resolves(TestUtil.getResourceXml(CHILD1_FOLDER + "metadata-de.xml"))
            // level -2
            .withArgs(CHILD2_URL, CHILD2_NAME, languages.find(l => l.isDefault))
            .resolves(TestUtil.getResourceXml(CHILD2_FOLDER + "metadata-en.xml"))
            .withArgs(CHILD2_URL, CHILD2_NAME, languages.find(l => l.sap === "DE"))
            .resolves(TestUtil.getResourceXml(CHILD2_FOLDER + "metadata-de.xml"));

        const files = await dataSourceManager.createAnnotationFiles(languages, i18nManager, serviceRequestor);
        expect(files.size).to.eql(filesCount);
        const expectedFilename = isOData
            ? "annotations/v4/metadata-2-v4-expected-odata/metadata.xml"
            : enableBetaFeatures
                ? "annotations/v4/metadata-2-v4-expected-odata-annotation/metadata-beta.xml"
                : "annotations/v4/metadata-2-v4-expected-odata-annotation/metadata.xml"
        const expected = TestUtil.getResourceXml(expectedFilename);
        const result = files.get("annotations/annotation_mainService.xml");
        if (result) {
            expect(result).to.eql(expected);
        }
    }

    function createAnnotationFiles(sandbox: SinonSandbox, dataSources: any, annotations: IChild[], config: IConfiguration): IUnderTestResult {
        const dataSourceManager = new DataSourceManager();
        dataSourceManager.addDataSources(dataSources, config);
        const languages = [new Language("", "")];
        const i18nManager = new I18nManager("model1", "appVariantId1", languages);
        const serviceRequestor = new ServiceRequestor({}, abapRepoManager);
        const stub = sandbox.stub(serviceRequestor, "downloadAnnotation");
        for (const { uri, name, xml } of annotations) {
            stub.withArgs(uri, name, languages.find(l => l.isDefault)).resolves(xml);
        }
        return { stub, files: dataSourceManager.createAnnotationFiles(languages, i18nManager, serviceRequestor) };
    }


    async function testTraverseMetadataUrl(metadataUrl: string) {
        const odata = metadataV4Xml(
            `<edmx:Reference Uri="../reference/to/child1">
                <edmx:Include Namespace="com.sap.vocabularies.IgnoreIt" Alias="OData1" />
            </edmx:Reference>`);
        const odataAnnotation = metadataV4Xml(
            `<edmx:Reference Uri="${metadataUrl}">
                <edmx:Include Namespace="com.sap.else.SomeOdataAnnotation1" Alias="Metadata1" />
            </edmx:Reference>`);
        const dataSourcesClone = structuredClone(dataSources) as any;
        dataSourcesClone.mainService.settings = {
            "annotations": [
                "annotatioName1"
            ]
        };
        dataSourcesClone.annotatioName1 = {
            "uri": "/odata/v2/annotationName1",
            "type": "ODataAnnotation",
        }
        const { stub, files } = createAnnotationFiles(sandbox, dataSourcesClone, [
            { xml: odataAnnotation, uri: "/odata/v2/annotationName1", name: "annotatioName1" },
            { xml: odata, uri: "/odata/v2/ManifestConfigurationService/$metadata", name: "mainService" }
        ], { enableBetaFeatures: true });
        await files;
        // Should download just odata and odataAnnotation xmls and not go deeper
        // to the references, since they are references to metadata and we
        // ignore them.
        expect(stub.getCalls().length).to.eql(2);
    }

});

interface IChild {
    xml: string;
    uri: string;
    name: string
}

interface IUnderTestResult {
    stub: sinon.SinonStub;
    files: Promise<Map<string, string>>;
}
