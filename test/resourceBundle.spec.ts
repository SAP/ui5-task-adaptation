import * as chai from "chai";
const { ResourceBundle } = require("../dist/bundle-resourceBundle");
const { expect } = chai;

describe("ResourceBundle", () => {
    it("shouldn normalize and generate language fallbacks", () => {
        expect(ResourceBundle._getFallbackLocales("iw_Latn_IL")).to.eql(["iw_IL", "iw", "en", ""]);
        expect(ResourceBundle._getFallbackLocales("he_Latn_IL")).to.eql(["iw_IL", "iw", "en", ""]);
        expect(ResourceBundle._getFallbackLocales("iw-IL")).to.eql(["iw_IL", "iw", "en", ""]);
        expect(ResourceBundle._getFallbackLocales("he-IL")).to.eql(["iw_IL", "iw", "en", ""]);
        expect(ResourceBundle._getFallbackLocales("zh-HK")).to.eql(["zh_HK", "zh_TW", "zh", "en", ""]);
        expect(ResourceBundle._getFallbackLocales("zh_CN")).to.eql(["zh_CN", "zh", "en", ""]);
    });
});