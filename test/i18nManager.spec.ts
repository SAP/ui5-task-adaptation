import * as chai from "chai";

import I18nManager, { I18nFileContent, PropertyValue } from "../src/i18nManager";

const { expect } = chai;

describe("I18nFileContent", () => {

    it("shouldn't return notFullLanguages if same languages processed", () => {
        const i18nFileContent = new I18nFileContent(["", "DE"]);
        i18nFileContent.add(PropertyValue.oldFrom("", "hello"), "a");
        i18nFileContent.add(PropertyValue.newFrom("DE", "hallo"), "a");
        expect([...i18nFileContent.createFiles("i18nFileName")]).to.eql([["i18nFileName/i18n.properties", "a=hello"], ["i18nFileName/i18n_de.properties", "a=hallo"]]);
    });

    it("shouldn't return notFullLanguages if no translations", () => {
        const i18nFileContent = new I18nFileContent([]);
        expect(i18nFileContent.createFiles("i18nFileName").size).to.eql(0);
    });

    it("should return notFullLanguages if some languages are not processed", () => {
        const i18nFileContent = new I18nFileContent(["", "DE"]);
        i18nFileContent.add(PropertyValue.oldFrom("", "hello"), "a");
        i18nFileContent.add(PropertyValue.newFrom("DE", "hallo"), "a");
        expect([...i18nFileContent.createFiles("i18nFileName")]).to.eql([["i18nFileName/i18n.properties", "a=hello"], ["i18nFileName/i18n_de.properties", "a=hallo"]]);
    });

});

describe("I18nManager", () => {

    describe("when only language in config and it's also a default language", () => {

        let i18nManager: I18nManager;

        beforeEach(() => i18nManager = new I18nManager("modelName1", "appVariantId1", ["", "EN"]));

        it("should not create translations if default language is the same", () => {
            const annotationJsons = new Map<string, any>([["", { s: "a" }], ["EN", { s: "a" }]]);
            i18nManager.populateTranslations(annotationJsons);
            expect(i18nManager.createFiles("i18n").size).to.eql(0);
        });

        it("should create translations if default language is different", () => {
            const annotationJsons = new Map<string, any>([["", { s: "a" }], ["EN", { s: "b" }]]);
            i18nManager.populateTranslations(annotationJsons);
            expect(i18nManager.createFiles("i18n").size).to.eql(2);
        });

    });

    describe("when extracting default language", () => {

        it("should return ''", () => {
            const annotationJsons = new Map<string, any>([["", { s: "a" }], ["EN", { s: "a" }]]);
            expect(I18nManager.extractDefaultLanguageAnnotation(annotationJsons).language).to.eql("");
        });

        it("should return 'EN'", () => {
            const annotationJsons = new Map<string, any>([["FR", { s: "a" }], ["EN", { s: "a" }]]);
            expect(I18nManager.extractDefaultLanguageAnnotation(annotationJsons).language).to.eql("EN");
        });

        it("should return first language", () => {
            const annotationJsons = new Map<string, any>([["FR", { s: "a" }], ["DE", { s: "a" }]]);
            expect(I18nManager.extractDefaultLanguageAnnotation(annotationJsons).language).to.eql("FR");
        });

    });

});