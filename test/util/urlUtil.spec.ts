import UrlUtil from "../../src/util/urlUtil.js";
import { expect } from "chai";

describe("should have the same result if", () => {
    [
        "/sap/opu/odata/IWFND/CATALOGSERVICE;v=2/Annotations(TechnicalName='MDL',Version='0001')/$value/",
        "/sap/opu/odata/IWFND/CATALOGSERVICE;v=2/Annotations(TechnicalName='MDL',Version='0001')/$value"
    ].forEach(parentUrl => {
        const slashPart = parentUrl.endsWith("/") ? "with" : "without";
        const urlPart = parentUrl.startsWith("https") ? "with domain" : "relative url";
        it(`join urls ${slashPart} trailing slash ${urlPart}`, () => {
            expect(UrlUtil.join("../../../sap/fco_/$metadata", parentUrl)).to.eql("/sap/opu/odata/sap/fco_/$metadata");
        });
    });
});

describe("when having url with domain", () => {
    it("should remove domain/host/port part", () => {
        expect(UrlUtil.getResourcePath("https://sap.com:443/sap/opu/odata/IWFND/CATALOGSERVICE;v=2/Annotations(TechnicalName='MDL',Version='0001')/$value"))
            .to.eql("/sap/opu/odata/IWFND/CATALOGSERVICE;v=2/Annotations(TechnicalName='MDL',Version='0001')/$value");
    });
    it("should do nothing if already relative", () => {
        expect(UrlUtil.getResourcePath("/sap/opu/odata/IWFND/CATALOGSERVICE;v=2/Annotations(TechnicalName='MDL',Version='0001')/$value"))
            .to.eql("/sap/opu/odata/IWFND/CATALOGSERVICE;v=2/Annotations(TechnicalName='MDL',Version='0001')/$value");
    });
});
