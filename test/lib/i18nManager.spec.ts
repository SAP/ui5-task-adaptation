import * as chai from "chai";

import I18nManager, { I18nFileContent, PropertyValue } from "../../src/i18nManager.js";

import Language from "../../src/model/language.js";

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