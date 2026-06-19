import { expect } from "chai";

import AbapValidator from "../../src/util/validator/abapValidator.js";
import { IConfiguration } from "../../src/model/configuration.js";

describe("AbapValidator", () => {
    let validator: AbapValidator;

    beforeEach(() => {
        validator = new AbapValidator();
    });

    it("should have type 'abap'", () => {
        expect(validator.type).to.equal("abap");
    });

    it("should pass when destination is provided", () => {
        const configuration = { destination: "myDestination" } as IConfiguration;
        expect(() => validator.validateConfiguration(configuration)).to.not.throw();
    });

    it("should pass when target is provided instead of destination", () => {
        const configuration = { target: { url: "https://example.com" } } as IConfiguration;
        expect(() => validator.validateConfiguration(configuration)).to.not.throw();
    });

    it("should throw when neither destination nor target is provided", () => {
        const configuration = {} as IConfiguration;
        expect(() => validator.validateConfiguration(configuration)).to.throw("'target' should be specified in ui5.yaml configuration");
    });
});
