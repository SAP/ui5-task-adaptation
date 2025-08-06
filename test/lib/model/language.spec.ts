import * as chai from "chai";

import Language from "../../../src/model/language.js";

const { expect } = chai;


describe("when getting languages from configuration", () => {
	it("should convert language string array to language object array", () => {
		const langaugeStrArr = ["ZH", "TH", "EN"];
		const expecedLanguageObjArr: Language[] = [
			{ sap: "ZH", i18n: "zh", isDefault: false },
			{ sap: "TH", i18n: "th", isDefault: false },
			{ sap: "EN", i18n: "en", isDefault: true }
		];
		expect(Language.create(langaugeStrArr)).to.eql(expecedLanguageObjArr);
	});

	it("should convert object array to language object array", () => {
		const langaugeObjArr = [
			{ sap: "ZH", i18n: "zh_CN" },
			{ sap: "TH", i18n: "th" },
			{ sap: "EN", i18n: "en" }
		];
		const expecedLanguageObjArr: Language[] = [
			{ sap: "ZH", i18n: "zh_CN", isDefault: false },
			{ sap: "TH", i18n: "th", isDefault: false },
			{ sap: "EN", i18n: "en", isDefault: true }
		];
		expect(Language.create(langaugeObjArr)).to.eql(expecedLanguageObjArr);
	});

	it("should convert object array to language object array, english is low case", () => {
		const langaugeObjArr = [
			{ sap: "ZH", i18n: "zh_CN" },
			{ sap: "TH", i18n: "th" },
			{ sap: "en", i18n: "en" }
		];
		const expecedLanguageObjArr: Language[] = [
			{ sap: "ZH", i18n: "zh_CN", isDefault: false },
			{ sap: "TH", i18n: "th", isDefault: false },
			{ sap: "en", i18n: "en", isDefault: true }
		];
		expect(Language.create(langaugeObjArr)).to.eql(expecedLanguageObjArr);
	});

	it("should convert object array to language object array, no english", () => {
		const languageObjArr = [
			{ sap: "EN", i18n: "en", isDefault: true },
			{ sap: "ZH", i18n: "zh_CN" },
			{ sap: "TH", i18n: "th" }
		];
		const expectedLanguageObjArr: Language[] = [
			{ sap: "EN", i18n: "en", isDefault: true },
			{ sap: "ZH", i18n: "zh_CN", isDefault: false },
			{ sap: "TH", i18n: "th", isDefault: false }
		];
		expect(Language.create(languageObjArr)).to.eql(expectedLanguageObjArr);
	});

	it("should convert object array to language object array, another english us", () => {
		const languageObjArr = [
			{ sap: "ZH", i18n: "zh_CN" },
			{ sap: "TH", i18n: "th" },
			{ sap: "EN", i18n: "en" },
			{ sap: "EN_US", i18n: "en_us" }
		];
		const expectedLanguageObjArr: Language[] = [
			{ sap: "ZH", i18n: "zh_CN", isDefault: false },
			{ sap: "TH", i18n: "th", isDefault: false },
			{ sap: "EN", i18n: "en", isDefault: true },
			{ sap: "EN_US", i18n: "en_us", isDefault: false }
		];
		expect(Language.create(languageObjArr)).to.eql(expectedLanguageObjArr);
	});

	it("should create default if config language is undefined", () => {
		const expectedLanguageObjArr: Language[] = [
			{ sap: "EN", i18n: "en", isDefault: true }
		];
		expect(Language.create(undefined)).to.eql(expectedLanguageObjArr);
	});

	it("should take the first language in the configured list if no EN present", () => {
		const languages = Language.create([{ sap: "DE", i18n: "de" }, { sap: "FR", i18n: "fr" }]);
		expect(languages.find(l => l.isDefault)).to.eql({ sap: "DE", i18n: "de", isDefault: true });
	});

	it("should set EN by default if no languages configured", () => {
		expect(Language.create([]).find(l => l.isDefault)).to.eql({ sap: "EN", i18n: "en", isDefault: true });
	});
});