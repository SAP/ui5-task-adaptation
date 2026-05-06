import { expect } from "chai";

import { validateAppId } from "../../src/util/validator/validator.js";

describe("validateAppId", () => {
    it("should throw if id has only one segment", () => {
        expect(() => validateAppId("singleSegment")).to.throw("must have at least two parts, separated by a period");
    });

    it("should throw if id is empty", () => {
        expect(() => validateAppId("")).to.throw("The application id must not be empty.");
    });

    it("should throw if id is only a period", () => {
        expect(() => validateAppId(".")).to.throw("must have at least two parts, separated by a period");
    });

    it("should throw if id has leading period", () => {
        expect(() => validateAppId(".foo")).to.throw("must have at least two parts, separated by a period");
    });

    it("should throw if id has trailing period", () => {
        expect(() => validateAppId("foo.")).to.throw("must have at least two parts, separated by a period");
    });

    it("should accept id with two segments", () => {
        expect(() => validateAppId("goo.faa")).to.not.throw();
    });

    it("should accept id with multiple segments", () => {
        expect(() => validateAppId("customer.base.app.id.variant1")).to.not.throw();
    });
});
