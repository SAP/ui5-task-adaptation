import * as chai from "chai";

import I18nManager, { I18nFileContent, PropertyValue } from "../../src/i18nManager.js";

import Language from "../../src/model/language.js";
import XmlUtil from "../../src/util/xmlUtil.js";

const { expect } = chai;


describe("I18nFileContent", () => {

    it("shouldn't return notFullLanguages if same languages processed", () => {
        const i18nFileContent = new I18nFileContent(Language.create(["EN", "DE"]));
        i18nFileContent.add(PropertyValue.oldFrom(new Language("EN", "en"), "hello"), "a");
        i18nFileContent.add(PropertyValue.newFrom(new Language("DE", "de"), "hallo"), "a");//simulates legacy language format
        expect([...i18nFileContent.createFiles("i18nFileName")]).to.eql([
            ["i18nFileName/i18n.properties", "a=hello"],
            ["i18nFileName/i18n_en.properties", "a=hello"],
            ["i18nFileName/i18n_de.properties", "a=hallo"]
        ]);
    });


    it("should create file name with i18n language code if exists", () => {
        const languageObjs = [{ sap: "EN", i18n: "en" }, { sap: "ZH", i18n: "zh_CN" }]
        const i18nFileContent = new I18nFileContent(Language.create(languageObjs));
        i18nFileContent.add(PropertyValue.oldFrom(new Language("EN", "en"), "hello"), "a");
        i18nFileContent.add(PropertyValue.newFrom(new Language("ZH", "zh_CN"), "你好"), "a");
        expect([...i18nFileContent.createFiles("i18nFileName")]).to.eql([
            ["i18nFileName/i18n.properties", "a=hello"],
            ["i18nFileName/i18n_en.properties", "a=hello"],
            ["i18nFileName/i18n_zh_CN.properties", "a=你好"]
        ]);
    });

});



describe("I18nManager", () => {

    it("should preserve namespace attributes when extracting values from a node missing in another language", async () => {
        const languages = Language.create(["EN", "DE"]);
        const manager = new I18nManager("i18n", "test", languages);
        const english = `<edmx:Edmx><edmx:DataServices><Schema Namespace="Example">
            <Annotations Target="Example.Shared" xmlns="http://docs.oasis-open.org/odata/ns/edm">
                <Annotation Term="Common.Label" String="Shared"/>
            </Annotations>
            <Annotations Target="Example.Optional" xmlns="http://docs.oasis-open.org/odata/ns/edm" xmlns:custom="urn:custom" xml:lang="en" xml:space="preserve">
                <Annotation Term="Common.Label" String="Agency" Value="Agency Name"/>
                <Annotation Term="Common.QuickInfo"><String><![CDATA[Details]]></String></Annotation>
            </Annotations>
        </Schema></edmx:DataServices></edmx:Edmx>`;
        const german = `<edmx:Edmx><edmx:DataServices><Schema Namespace="Example">
            <Annotations Target="Example.Shared" xmlns="http://docs.oasis-open.org/odata/ns/edm">
                <Annotation Term="Common.Label" String="Gemeinsam"/>
            </Annotations>
        </Schema></edmx:DataServices></edmx:Edmx>`;
        const result = await manager.populateTranslations(new Map([
            [languages[0], Promise.resolve(XmlUtil.xmlToJson(english))],
            [languages[1], Promise.resolve(XmlUtil.xmlToJson(german))]
        ]));

        expect(manager.createFiles("i18n")).to.eql(new Map([
            ["i18n/i18n.properties", "test_AGENCY=Agency\ntest_AGENCY_NAME=Agency Name\ntest_DETAILS=Details\ntest_SHARED=Shared"],
            ["i18n/i18n_en.properties", "test_AGENCY=Agency\ntest_AGENCY_NAME=Agency Name\ntest_DETAILS=Details\ntest_SHARED=Shared"],
            ["i18n/i18n_de.properties", "test_AGENCY=\ntest_AGENCY_NAME=\ntest_DETAILS=\ntest_SHARED=Gemeinsam"]
        ]));
        const expected = english.replace('String="Shared"', 'String="{i18n>test_SHARED}"')
            .replace('String="Agency"', 'String="{i18n>test_AGENCY}"')
            .replace('Value="Agency Name"', 'Value="{i18n>test_AGENCY_NAME}"')
            .replace("<![CDATA[Details]]>", "<![CDATA[{i18n>test_DETAILS}]]>");
        expect(XmlUtil.jsonToXml(await result.json)).to.eql(XmlUtil.jsonToXml(XmlUtil.xmlToJson(expected)));
    });

    describe("when only language in config and it's also a default language", () => {

        let i18nManager: I18nManager;

        const json = {
            "edmx:Edmx": {
                "edmx:DataServices": {
                    "Schema": {
                        "Annotations": [
                            {
                                "_attributes": {
                                    "Target": "SAP__self.M2_C_BookSup_MDUU/CurrencyCode"
                                },
                                "Annotation": [
                                    {
                                        "_attributes": {
                                            "Term": "SAP__common.Label",
                                            "String": "Currency"
                                        }
                                    }
                                ]
                            }
                        ]
                    }
                }
            }
        }

        beforeEach(() => i18nManager = new I18nManager("modelName1", "appVariantId1", Language.create(["EN"])));

        it("should not create translations if default language is the same", async () => {
            const annotationJsons = new Map<Language, any>([[new Language("EN", "en"), json], [new Language("EN", "en"), json]]);
            await i18nManager.populateTranslations(annotationJsons);
            expect(i18nManager.createFiles("i18n").size).to.eql(0);
        });

        it("should create translations if default language is different", async () => {
            const clone = structuredClone(json) as any;
            clone["edmx:Edmx"]["edmx:DataServices"].Schema.Annotations[0].Annotation[0]._attributes.String = "Valuta";
            const annotationJsons = new Map<Language, any>([[new Language("EN", "en"), json], [new Language("EN", "en"), clone]]);
            await i18nManager.populateTranslations(annotationJsons);
            expect(i18nManager.createFiles("i18n").size).to.eql(2);
        });

    });

    describe("when extracting default language", () => {

        it("should return 'en'", () => {
            const annotationJsons = new Map<Language, any>([[new Language("EN", "en"), { s: "a" }], [new Language("EN", "en_EN", true), { s: "a" }]]);
            expect(I18nManager.extractDefaultLanguageAnnotation(annotationJsons).language).to.eql(new Language("EN", "en_EN", true));
        });

        it("should return 'en' as default language although it's not at the first place", () => {
            const annotationJsons = new Map<Language, any>([[new Language("FR", "fr_FR"), { s: "a" }], [new Language("EN", "en", true), { s: "a" }]]);
            expect(I18nManager.extractDefaultLanguageAnnotation(annotationJsons).language).to.eql(new Language("EN", "en", true));
        });

        it("should return first language", () => {
            const annotationJsons = new Map<Language, any>([[new Language("FR", "fr_FR"), { s: "a" }], [new Language("DE", "de_DE"), { s: "a" }]]);
            expect(I18nManager.extractDefaultLanguageAnnotation(annotationJsons).language).to.eql(new Language("FR", "fr_FR"));
        });

    });

});
