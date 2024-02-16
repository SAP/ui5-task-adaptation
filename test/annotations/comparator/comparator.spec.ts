import Comparator from "../../../src/annotations/comparator/comparator";
import DataSourceOData from "../../../src/annotations/dataSource/dataSourceOData";
import XmlUtil from "../../../src/util/xmlUtil";
import { expect } from "chai";

describe("Comparator", () => {

    // Test 01
    const interchangableTerms = ["SAP__common.Label", "SAP__common.Heading", "SAP__common.QuickInfo"];
    describe(`when ${interchangableTerms.join(" or ")} is missing (test 01)`, () => {
        for (const copyFrom of interchangableTerms) {
            for (const include of interchangableTerms) {
                if (copyFrom !== include) {
                    it(`should include ${include} and copy value from ${copyFrom}`, () => {
                        const a = XmlUtil.xmlToJson(completeXml(`
            <Annotations Target="SAP__self.DraftUserAccessType/UserAccessRole">
                <Annotation Term="${copyFrom}" String="value" />
            </Annotations>`));
                        const b = XmlUtil.xmlToJson(completeXml(`
            <Annotations Target="SAP__self.DraftUserAccessType/UserAccessRole">
                <Annotation Term="${copyFrom}" String="wert 1" />
                <Annotation Term="${include}" String="wert 2" />
            </Annotations>`));
                        const { json } = new Comparator(a, b).compare();
                        expect(XmlUtil.jsonToXml(json)).to.eql(completeXml(`
            <Annotations Target="SAP__self.DraftUserAccessType/UserAccessRole">
                <Annotation Term="${copyFrom}" String="{ __old: value,  __new: wert 1 }"/>
                <Annotation Term="${include}" String="{ __old: value,  __new: wert 2 }"/>
            </Annotations>`));
                    });
                }
            }
        }
    });

    // Test 02b
    it("should include Heading with corresponding translation (test 02b)", () => {
        const a = XmlUtil.xmlToJson(completeXml(`
            <Annotations Target="SAP__self.DraftUserAccessType/UserAccessRole">
                <Annotation Term="SAP__common.Label" String="label" />
            </Annotations>`));
        const b = XmlUtil.xmlToJson(completeXml(`
            <Annotations Target="SAP__self.DraftUserAccessType/UserAccessRole">
                <Annotation Term="SAP__common.Label" String="titel" />
                <Annotation Term="SAP__common.Heading" String="währung"/>
            </Annotations>`));
        const { json } = new Comparator(a, b).compare();
        expect(XmlUtil.jsonToXml(json)).to.eql(completeXml(`
            <Annotations Target="SAP__self.DraftUserAccessType/UserAccessRole">
                <Annotation Term="SAP__common.Label" String="{ __old: label,  __new: titel }"/>
                <Annotation Term="SAP__common.Heading" String="{ __old: label,  __new: währung }"/>
            </Annotations>`));
    });

    // Test 02c
    it("should include Heading with corresponding translation copied from Label (test 02c)", () => {
        const a = XmlUtil.xmlToJson(completeXml(`
            <Annotations Target="SAP__self.DraftUserAccessType/UserAccessRole">
                <Annotation Term="SAP__common.Heading" String="heading"/>
                <Annotation Term="SAP__common.Label" String="label" />
            </Annotations>`));
        const b = XmlUtil.xmlToJson(completeXml(`
            <Annotations Target="SAP__self.DraftUserAccessType/UserAccessRole">
                <Annotation Term="SAP__common.Label" String="titel" />
            </Annotations>`));
        const { json } = new Comparator(a, b).compare();
        expect(XmlUtil.jsonToXml(json)).to.eql(completeXml(`
            <Annotations Target="SAP__self.DraftUserAccessType/UserAccessRole">
                <Annotation Term="SAP__common.Heading" String="{ __old: heading,  __new: titel }"/>
                <Annotation Term="SAP__common.Label" String="{ __old: label,  __new: titel }"/>
            </Annotations>`));
    });

    // Test 02
    it("should include other term annotation with empty value if missing in default language (test 02)", () => {
        const a = XmlUtil.xmlToJson(completeXml(`
            <Annotations Target="SAP__self.DraftUserAccessType/UserAccessRole">
                <Annotation Term="SAP__common.Label" String="label" />
            </Annotations>`));
        const b = XmlUtil.xmlToJson(completeXml(`
            <Annotations Target="SAP__self.DraftUserAccessType/UserAccessRole">
                <Annotation Term="SAP__common.Label" String="titel" />
                <Annotation Term="SAP__common.Currency" String="wahrung"/>
            </Annotations>`));
        const { json } = new Comparator(a, b).compare();
        expect(XmlUtil.jsonToXml(json)).to.eql(completeXml(`
            <Annotations Target="SAP__self.DraftUserAccessType/UserAccessRole">
                <Annotation Term="SAP__common.Label" String="{ __old: label,  __new: titel }"/>
                <Annotation Term="SAP__common.Currency" String="{ __old: ,  __new: wahrung }"/>
            </Annotations>`));
    });

    // Test 03
    it("should include other term annotation with default language value if missing in other language (test 03)", () => {
        const a = XmlUtil.xmlToJson(completeXml(`
            <Annotations Target="SAP__self.DraftUserAccessType/UserAccessRole">
                <Annotation Term="SAP__common.Label" String="label" />
                <Annotation Term="SAP__common.Currency" String="currency"/>
            </Annotations>`));
        const b = XmlUtil.xmlToJson(completeXml(`
            <Annotations Target="SAP__self.DraftUserAccessType/UserAccessRole">
                <Annotation Term="SAP__common.Label" String="titel" />
            </Annotations>`));
        const { json } = new Comparator(a, b).compare();
        expect(XmlUtil.jsonToXml(json)).to.eql(completeXml(`
            <Annotations Target="SAP__self.DraftUserAccessType/UserAccessRole">
                <Annotation Term="SAP__common.Label" String="{ __old: label,  __new: titel }"/>
                <Annotation Term="SAP__common.Currency" String="{ __old: currency,  __new:  }"/>
            </Annotations>`));
    });

    // Test 04
    it("should add all missing items (test 04)", () => {
        const a = XmlUtil.xmlToJson(completeXml(`
            <Annotations Target="SAP__self.DraftUserAccessType/UserAccessRole">
                <Annotation Term="SAP__common.Currency" String="currency"/>
            </Annotations>`));
        const b = XmlUtil.xmlToJson(completeXml(`
            <Annotations Target="SAP__self.DraftUserAccessType/UserAccessRole">
                <Annotation Term="SAP__common.Label" String="titel" />
            </Annotations>`));
        const { json } = new Comparator(a, b).compare();
        expect(XmlUtil.jsonToXml(json)).to.eql(completeXml(`
            <Annotations Target="SAP__self.DraftUserAccessType/UserAccessRole">
                <Annotation Term="SAP__common.Label" String="{ __old: ,  __new: titel }"/>
                <Annotation Term="SAP__common.Currency" String="{ __old: currency,  __new:  }"/>
            </Annotations>`));
    });

    // Test 04a
    it("should add all missing items (test 04a) default to other", () => {
        const a = XmlUtil.xmlToJson(completeXml(`
            <Annotations Target="SAP__self.DraftUserAccessType/UserAccessRole">
                <Annotation Term="SAP__common.Label" String="label" />
            </Annotations>
            <Annotations Target="SAP__self.TravelAgencyType/Name">
                <Annotation Term="SAP__common.Label" String="Agency Name" />
                <Annotation Term="SAP__common.Heading" String="Agency" />
                <Annotation Term="SAP__common.QuickInfo" String="Flight Reference Scenario: Agency Name" />
            </Annotations>`));
        const b = XmlUtil.xmlToJson(completeXml(`
            <Annotations Target="SAP__self.DraftUserAccessType/UserAccessRole">
                <Annotation Term="SAP__common.Label" String="titel" />
            </Annotations>`));
        const { json } = new Comparator(a, b).compare();
        expect(XmlUtil.jsonToXml(json)).to.eql(completeXml(`
            <Annotations Target="SAP__self.DraftUserAccessType/UserAccessRole">
                <Annotation Term="SAP__common.Label" String="{ __old: label,  __new: titel }"/>
            </Annotations>
            <Annotations Target="SAP__self.TravelAgencyType/Name">
                <Annotation Term="SAP__common.Label" String="{ __old: Agency Name,  __new:  }"/>
                <Annotation Term="SAP__common.Heading" String="{ __old: Agency,  __new:  }"/>
                <Annotation Term="SAP__common.QuickInfo" String="{ __old: Flight Reference Scenario: Agency Name,  __new:  }"/>
            </Annotations>`));
    });

    // Test 04b
    it("should add all missing items (test 04a) other to default", () => {
        const a = XmlUtil.xmlToJson(completeXml(`
            <Annotations Target="SAP__self.DraftUserAccessType/UserAccessRole">
                <Annotation Term="SAP__common.Label" String="label" />
            </Annotations>`));
        const b = XmlUtil.xmlToJson(completeXml(`
            <Annotations Target="SAP__self.DraftUserAccessType/UserAccessRole">
                <Annotation Term="SAP__common.Label" String="titel" />
            </Annotations>
            <Annotations Target="SAP__self.TravelAgencyType/Name">
                <Annotation Term="SAP__common.Label" String="Agency Name" />
                <Annotation Term="SAP__common.Heading" String="Agency" />
                <Annotation Term="SAP__common.QuickInfo" String="Flight Reference Scenario: Agency Name" />
            </Annotations>`));
        const { json } = new Comparator(a, b).compare();
        expect(XmlUtil.jsonToXml(json)).to.eql(completeXml(`
            <Annotations Target="SAP__self.DraftUserAccessType/UserAccessRole">
                <Annotation Term="SAP__common.Label" String="{ __old: label,  __new: titel }"/>
            </Annotations>
            <Annotations Target="SAP__self.TravelAgencyType/Name">
                <Annotation Term="SAP__common.Label" String="{ __old: ,  __new: Agency Name }"/>
                <Annotation Term="SAP__common.Heading" String="{ __old: ,  __new: Agency }"/>
                <Annotation Term="SAP__common.QuickInfo" String="{ __old: ,  __new: Flight Reference Scenario: Agency Name }"/>
            </Annotations>`));
    });

    // Test 05
    it("should compare though different items order (test 05)", () => {
        const a = XmlUtil.xmlToJson(completeXml(`
            <Annotations Target="SAP__self.DraftUserAccessType/UserAccessRole">
                <Annotation Term="SAP__common.Label" String="label" />
                <Annotation Term="SAP__common.Currency" String="currency"/>
            </Annotations>`));
        const b = XmlUtil.xmlToJson(completeXml(`
            <Annotations Target="SAP__self.DraftUserAccessType/UserAccessRole">
                <Annotation Term="SAP__common.Currency" String="wahrung"/>
                <Annotation Term="SAP__common.Label" String="titel" />
            </Annotations>`));
        const { json } = new Comparator(a, b).compare();
        expect(XmlUtil.jsonToXml(json)).to.eql(completeXml(`
            <Annotations Target="SAP__self.DraftUserAccessType/UserAccessRole">
                <Annotation Term="SAP__common.Label" String="{ __old: label,  __new: titel }"/>
                <Annotation Term="SAP__common.Currency" String="{ __old: currency,  __new: wahrung }"/>
            </Annotations>`));
    });

    // Test 06
    it("should throw error when different xml structure (test 06)", () => {
        const a = XmlUtil.xmlToJson(completeXml(`
            <Annotations Target="SAP__self.DraftUserAccessType/UserAccessRole">
                <Annotation Term="SAP__common.Label" String="label value" />
            </Annotations>`));
        const b = XmlUtil.xmlToJson(completeXml(`
            <Annotations Target="SAP__self.DraftUserAccessType/UserAccessRole">
                <Annotation Term="SAP__common.Label">
                    <String>titel wert</String>
                </Annotation>
            </Annotations>`));
        const comparator = new Comparator(a, b);
        expect(() => comparator.compare()).to.throw(`The structure of the OData annotation xml is different near element: {"a":"label value"}`);
    });

    // Test 07
    it("should throw error when attribute in one language is missing (test 07)", () => {
        const a = XmlUtil.xmlToJson(completeXml(`
            <Annotations Target="SAP__self.DraftUserAccessType/UserAccessRole">
                <Some String="value 1" />
            </Annotations>`));
        const b = XmlUtil.xmlToJson(completeXml(`
            <Annotations Target="SAP__self.DraftUserAccessType/UserAccessRole">
                <Some />
            </Annotations>`));
        const comparator = new Comparator(a, b);
        expect(() => comparator.compare()).to.throw(`The structure of the OData annotation xml is different near element: {"a":{"String":"value 1"}}`);
    });

    // Test 08
    it("should throw error when different xml structure (test 08)", () => {
        const a = XmlUtil.xmlToJson(completeXml(`
            <Annotations Target="SAP__self.DraftUserAccessType/UserAccessRole">
                <Some String="value 1" />
            </Annotations>`));
        const b = XmlUtil.xmlToJson(completeXml(`
            <Annotations Target="SAP__self.DraftUserAccessType/UserAccessRole">
                <Some String="value 1" />
                <Some String="value 2" />
            </Annotations>`));
        const comparator = new Comparator(a, b);
        expect(() => comparator.compare()).to.throw(`The structure of the OData annotation xml is different near element: {"a":[{"_attributes":{"String":"value 1"}}],"b":[{"_attributes":{"String":"value 1"}},{"_attributes":{"String":"value 2"}}]}`);
    });

});

describe("DataSourceOData: addNewODataAnnotation", () => {

    const manifestJsonDataSources: any = {
        "mainService": {
            "uri": "/sap/opu/odata/sap/UI_CRDTMGMTACCOUNT_MANAGE/",
            "type": "OData",
            "settings": {
                "annotations": [
                    "UI_CRDTMGMTACCOUNT_MANAGE_VAN",
                    "annotation"
                ],
                "localUri": "localService/metadata.xml",
                "odataVersion": "2.0"
            }
        },
        "UI_CRDTMGMTACCOUNT_MANAGE_VAN": {
            "uri": "annotations/annotation_UI_CRDTMGMTACCOUNT_MANAGE_VAN.xml",
            "type": "ODataAnnotation",
            "settings": {
                "localUri": "localService/UI_CRDTMGMTACCOUNT_MANAGE_VAN.xml"
            }
        },
        "annotation": {
            "type": "ODataAnnotation",
            "uri": "annotations/annotation.xml",
            "settings": {
                "localUri": "annotations/annotation.xml"
            }
        }
    };

    it("should add new OData annotation with the same name existing", () => {
        const clone = structuredClone(manifestJsonDataSources);
        clone.annotation_mainService = {
            "type": "ODataAnnotation",
            "uri": "annotations/annotation_mainService.xml"
        };
        const name = "mainService";
        const dataSource = new DataSourceOData(name, "uri", clone[name]);
        dataSource.addNewODataAnnotation(clone);
        expect(clone.mainService.settings.annotations).to.have.members([
            "annotation_mainService0",
            "UI_CRDTMGMTACCOUNT_MANAGE_VAN",
            "annotation"
        ]);
        expect(clone["annotation_mainService0"]).to.eql({
            "type": "ODataAnnotation",
            "uri": "annotations/annotation_mainService.xml"
        });
    });

    it("should add new OData annotation", () => {
        const name = "mainService";
        const dataSource = new DataSourceOData(name, "uri", manifestJsonDataSources[name]);
        dataSource.addNewODataAnnotation(manifestJsonDataSources);
        expect(manifestJsonDataSources.mainService.settings.annotations).to.have.members([
            "annotation_mainService",
            "UI_CRDTMGMTACCOUNT_MANAGE_VAN",
            "annotation"
        ]);
        expect(manifestJsonDataSources["annotation_mainService"]).to.eql({
            "type": "ODataAnnotation",
            "uri": "annotations/annotation_mainService.xml"
        });
    });
});


function completeXml(xml: string) {
    return `<?xml version="1.0" encoding="utf-8"?>
<edmx:Edmx>
    <edmx:DataServices>
        <Schema Namespace="com.sap.gateway.srvd.m2_sd_travel_mduu.v0001" Alias="SAP__self">${xml}
        </Schema>
    </edmx:DataServices>
</edmx:Edmx>`
}
