import { initialize } from "../../src/landscapeConfiguration.js";
import { expect } from "chai";
import AbapAdapter from "../../src/adapters/abapAdapter.js";
import CFAdapter from "../../src/adapters/cfAdapter.js";

describe("Processor", () => {

    after(() => delete process.env.H2O_URL);

    it("should determine ABAP config by type", () => {
        const { adapter } = initialize({
            type: "abap",
            appName: "appName",
            target: {
                url: "abc"
            }
        });
        expect(adapter instanceof AbapAdapter).to.be.true;
    });

    it("should throw validation exception - no type found", () => {
        expect(() => initialize({
            appName: "appName",
            target: {
                url: "abc"
            }
        })).to.throw("should be specified in ui5.yaml configuration: 'cf' or 'abap'");
    });

    it("should determine CF config", () => {
        const { adapter } = initialize({
            appHostId: "appHostId",
            appId: "appId",
            appName: "appName",
            appVersion: "appVersion",
            space: "spaceGuid",
            org: "orgGuid",
            sapCloudService: "sapCloudService",
            type: "cf"
        });
        expect(adapter instanceof CFAdapter).to.be.true;
    });

});
