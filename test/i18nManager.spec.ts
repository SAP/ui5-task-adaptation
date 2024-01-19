import * as chai from "chai";

import I18nManager, { I18nFileContent, PropertyValue } from "../src/i18nManager";
import Language from "../src/model/language";

const { expect } = chai;


describe("I18nFileContent", () => {

    it("shouldn't return notFullLanguages if same languages processed", () => {
        const i18nFileContent = new I18nFileContent(Language.create(["DE"]));
        i18nFileContent.add(PropertyValue.oldFrom(new Language("", ""), "hello"), "a");
        i18nFileContent.add(PropertyValue.newFrom(new Language("DE", "de"), "hallo"), "a");//simulates legacy language format
        expect([...i18nFileContent.createFiles("i18nFileName")]).to.eql([["i18nFileName/i18n.properties", "a=hello"], ["i18nFileName/i18n_de.properties", "a=hallo"]]);
    });


    it("should create file name with i18n language code if exists", () => {
        const languageObjs = [{ sap: "", i18n: "" }, { sap: "ZH", i18n: "zh_CN" }]
        const i18nFileContent = new I18nFileContent(Language.create(languageObjs));
        i18nFileContent.add(PropertyValue.oldFrom(new Language("", ""), "hello"), "a");
        i18nFileContent.add(PropertyValue.newFrom(new Language("ZH", "zh_CN"), "你好"), "a");
        expect([...i18nFileContent.createFiles("i18nFileName")]).to.eql([["i18nFileName/i18n.properties", "a=hello"], ["i18nFileName/i18n_zh_CN.properties", "a=你好"]]);
    });

});



describe("I18nManager", () => {

    describe("when only language in config and it's also a default language", () => {

        let i18nManager: I18nManager;

        beforeEach(() => i18nManager = new I18nManager("modelName1", "appVariantId1", Language.create(["EN"])));

        it("should not create translations if default language is the same", () => {
            const annotationJsons = new Map<Language, any>([[new Language("", ""), { s: "a" }], [new Language("", ""), { s: "a" }]]);
            i18nManager.populateTranslations(annotationJsons);
            expect(i18nManager.createFiles("i18n").size).to.eql(0);
        });

        it("should create translations if default language is different", () => {
            const annotationJsons = new Map<Language, any>([[new Language("", ""), { s: "a" }], [new Language("", ""), { s: "b" }]]);
            i18nManager.populateTranslations(annotationJsons);
            expect(i18nManager.createFiles("i18n").size).to.eql(2);
        });

    });

    describe("when extracting default language", () => {

        it("should return ''", () => {
            const annotationJsons = new Map<Language, any>([[new Language("",""), { s: "a" }], [new Language("EN", "en_EN"), { s: "a" }]]);
            expect(I18nManager.extractDefaultLanguageAnnotation(annotationJsons).language).to.eql(new Language("",""));
        });

        it("should return '' as default language although it's not at the first place", () => {
            const annotationJsons = new Map<Language, any>([[new Language("FR", "fr_FR"), { s: "a" }], [new Language("", ""), { s: "a" }]]);
            expect(I18nManager.extractDefaultLanguageAnnotation(annotationJsons).language).to.eql(new Language("",""));
        });

        it("should return first language", () => {
            const annotationJsons = new Map<Language, any>([[new Language("FR", "fr_FR"), { s: "a" }], [new Language("DE", "de_DE"), { s: "a" }]]);
            expect(I18nManager.extractDefaultLanguageAnnotation(annotationJsons).language).to.eql(new Language("FR","fr_FR"));
        });

    });

});  