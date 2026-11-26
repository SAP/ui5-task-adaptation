import DataSource from "../../../../src/annotations/dataSource/dataSource.js";
import DataSourceOData from "../../../../src/annotations/dataSource/dataSourceOData.js";
import I18nManager from "../../../../src/i18nManager.js";
import IRepository from "../../../../src/repositories/repository.js";
import Language from "../../../../src/model/language.js";
import MetadataJsonUtil from "../../../../src/annotations/converter/metadataJsonUtil.js";
import XmlUtil from "../../../../src/util/xmlUtil.js";
import { expect } from "chai";

describe("DataSource", () => {

    describe("constructor name validation", () => {

        const validNames = [
            "mainService",
            "ANNOTATION_1",
            "my.data-source",
            "a",
            "A.B_C-D",
        ];

        for (const name of validNames) {
            it(`should accept valid name '${name}'`, () => {
                expect(() => new (DataSource as any)(name, "/uri")).to.not.throw();
            });
        }

        const invalidNames = [
            "name with spaces",
            "name/with/slash",
            "name<script>",
            "name>",
            "name&value",
            "safe\n",
            // URL injection
            "../traversal",
            "name?param=val",
            "name#fragment",
            "name%2Fencoded",
            "",
        ];

        for (const name of invalidNames) {
            it(`should throw for invalid name '${name}'`, () => {
                expect(() => new (DataSource as any)(name, "/uri"))
                    .to.throw(`Invalid dataSource name '${name}'`);
            });
        }

    });

});

describe("DataSourceOData", () => {

    it("should preserve the annotation namespace when a V2 property has no sap:label in zh_TW", async () => {
        const uri = "/sap/opu/odata/sap/MM_SUPPLIER_INVOICE_MANAGE/$metadata";
        const target = "MM_SUPPLIER_INVOICE_MANAGE_Entities.VL_SH_FAC_WHTX_CODE/TEXT40";
        const english = `<edmx:Edmx Version="1.0" xmlns:edmx="http://schemas.microsoft.com/ado/2007/06/edmx" xmlns:sap="http://www.sap.com/Protocols/SAPData">
            <edmx:Reference Uri="/vocabularies/Common.xml" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
                <edmx:Include Namespace="com.sap.vocabularies.Common.v1" Alias="Common"/>
            </edmx:Reference>
            <edmx:DataServices xmlns:m="http://schemas.microsoft.com/ado/2007/08/dataservices/metadata" m:DataServiceVersion="2.0">
                <Schema Namespace="MM_SUPPLIER_INVOICE_MANAGE_Entities" xmlns="http://schemas.microsoft.com/ado/2008/09/edm">
                    <EntityType Name="VL_SH_FAC_WHTX_CODE">
                        <Key><PropertyRef Name="WT_WITHCD"/></Key>
                        <Property Name="WT_WITHCD" Type="Edm.String" Nullable="false" sap:label="W.Tax Code"/>
                        <Property Name="TEXT40" Type="Edm.String" MaxLength="40" sap:label="Name" sap:sortable="false"/>
                    </EntityType>
                </Schema>
            </edmx:DataServices>
        </edmx:Edmx>`;
        // Reproduce the suspected cause without removing the TEXT40 property:
        // V2 conversion omits its annotation group when sap:label is absent.
        const traditionalChinese = english.replace(' sap:label="Name"', "");
        const languages = Language.create([{ sap: "EN", i18n: "en" }, { sap: "ZF", i18n: "zh_TW" }]);
        const responses = new Map([
            [`${uri}?sap-language=EN`, english],
            [`${uri}?sap-language=ZF`, traditionalChinese]
        ]);
        const repository: IRepository = {
            getAppVariantIdHierarchy: async () => { throw new Error("Unexpected hierarchy request"); },
            fetch: async () => { throw new Error("Unexpected resource request"); },
            downloadAnnotationFile: async (requestUri) => {
                const xml = responses.get(requestUri);
                if (xml === undefined) {
                    throw new Error(`Unexpected annotation request: ${requestUri}`);
                }
                return xml;
            }
        };
        const dataSource = new DataSourceOData("mainService", uri, {});
        const i18nManager = new I18nManager("@i18n", "test", languages);

        const result = await dataSource.createAnnotationFile(languages, i18nManager, repository);

        const annotation = MetadataJsonUtil.getAnnotations(XmlUtil.xmlToJson(result.xml))
            .find(node => node._attributes.Target === target);
        expect(annotation).to.eql({
            _attributes: { Target: target, xmlns: "http://docs.oasis-open.org/odata/ns/edm" },
            Annotation: {
                _attributes: { Term: "com.sap.vocabularies.Common.v1.Label", String: "{@i18n>test_NAME}" }
            }
        });
        expect(i18nManager.createFiles("i18n")).to.eql(new Map([
            ["i18n/i18n.properties", "test_NAME=Name"],
            ["i18n/i18n_en.properties", "test_NAME=Name"],
            ["i18n/i18n_zh_TW.properties", "test_NAME="]
        ]));
    });

});
