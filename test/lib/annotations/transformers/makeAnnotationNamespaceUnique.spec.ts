import * as sinon from "sinon";

import Language from "../../../../src/model/language.js";
import MakeAnnotationNamespaceUnique from "../../../../src/annotations/transformers/makeAnnotationNamespaceUnique.js";
import ServiceRequestor from "../../../../src/annotations/serviceRequestor.js";
import { SinonSandbox } from "sinon";
import XmlUtil from "../../../../src/util/xmlUtil.js";
import { expect } from "chai";
import { metadataV4Xml } from "../../testUtilities/testUtil.js";

describe("MakeAnnotationNamespaceUnique", () => {

    let sandbox: SinonSandbox;

    beforeEach(async () => sandbox = sinon.createSandbox());
    afterEach(() => sandbox.restore());

    it("should rename namespace, create reference without alias and remove schema alias", () => {
        testTransform('<Schema Namespace="com.sap.self">', '<edmx:Include Namespace="com.sap.self"/>');
    });
    it("should rename namespace, create reference without alias and remove schema alias", () => {
        testTransform('<Schema Namespace="com.sap.self" Alias="SAP_self">', '<edmx:Include Namespace="com.sap.self" Alias="SAP_self"/>');
    });

    function testTransform(schema: string, expectedReference: string) {
        const metadata = metadataV4Xml(
            `<edmx:Reference Uri="../reference/to/child1">
                    <edmx:Include Namespace="CHILD_NAMESPACE" Alias="Child" />
                </edmx:Reference>`,
            `<Annotations Target="com.sap.self.SameTarget">
                    <Annotation Term="com.sap.self.Computed" />
                </Annotations>`, schema);
        const trnsformer = new MakeAnnotationNamespaceUnique();
        const result = XmlUtil.jsonToXml(trnsformer.transform({
            json: XmlUtil.xmlToJson(metadata),
            uri: "/odata/v2/ManifestConfigurationService/$metadata",
            language: new Language("EN", "en"),
            serviceRequestor: sandbox.createStubInstance(ServiceRequestor),
            xml: metadata
        }));
        expect(result).to.eql(metadataV4Xml(
            // Reference to the metadata was added
            `<edmx:Reference Uri="../reference/to/child1">
        <edmx:Include Namespace="CHILD_NAMESPACE" Alias="Child"/>
    </edmx:Reference>
    <edmx:Reference Uri="/odata/v2/ManifestConfigurationService/$metadata">
        ${expectedReference}
    </edmx:Reference>`,
            // Alias was renamed with unique suffix
            `<Annotations Target="com.sap.self.SameTarget">
                <Annotation Term="com.sap.self.Computed"/>
            </Annotations>`,
            // Schema namespace and alias were renamed with unique suffix
            `<Schema Namespace="com.sap.self.bb5">`));
    }
});
