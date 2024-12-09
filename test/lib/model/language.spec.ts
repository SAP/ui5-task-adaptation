import * as chai from "chai";

import Language from "../../../src/model/language.js";
const { expect } = chai;


describe("when getting languages from configuration", () => {
  it("should convert language string array to language object array", () => {
    const langaugeStrArr = ["ZH", "TH", "EN"];
    const expecedLanguageObjArr: Language[] = [
      { sap: "", i18n: "", isDefault: true },
      { sap: "ZH", i18n: "zh", isDefault: false },
      { sap: "TH", i18n: "th", isDefault: false },
      { sap: "EN", i18n: "en", isDefault: false }
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
      { sap: "", i18n: "", isDefault: true },
      { sap: "ZH", i18n: "zh_CN", isDefault: false },
      { sap: "TH", i18n: "th", isDefault: false },
      { sap: "EN", i18n: "en", isDefault: false }
    ];
    expect(Language.create(langaugeObjArr)).to.eql(expecedLanguageObjArr);
  });

  it("should create default if config language is undefined", () => {
    const expecedLanguageObjArr: Language[] = [
      { sap: "", i18n: "", isDefault: true }
    ];
    expect(Language.create(undefined)).to.eql(expecedLanguageObjArr);
  });
});