import convert from "../../../rollup/amdToEsm.js";
import { expect } from "chai";

describe("Convert AMD to ESM", () => {
    it("should extract class", () => {
        const result = convert(`sap.ui.define([ "sap/base/assert" ], function( assert ) { class Eventing { prop; } return Eventing; });`);
        expect(result).eql(`export default class Eventing { prop; }`);
    });

    it("should return same content if without class", () => {
        const result = convert(`sap.ui.define([ "sap/base/assert" ], function( assert ) { var Change = function () { }; });`);
        expect(result).eql(`sap.ui.define([ "sap/base/assert" ], function( assert ) { var Change = function () { }; });`);
    });
});
