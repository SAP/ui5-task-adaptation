import AbapProcessor from "../../src/processors/abapProcessor.js"
import CFProcessor from "../../src/processors/cfProcessor.js";
import { determineProcessor } from "../../src/processors/processor.js"
import { expect } from "chai";

describe("Processor", () => {

    after(() => delete process.env.H2O_URL);

    it("should determine ABAP config by type", () => {
        const processor = determineProcessor({
            type: "abap",
            appName: "appName",
            target: {
                url: "abc"
            }
        });
        expect(processor instanceof AbapProcessor);
    });

    it("should determine ABAP config by properties", () => {
        const processor = determineProcessor({
            appName: "appName",
            target: {
                url: "abc"
            }
        });
        expect(processor instanceof AbapProcessor);
    });

    it("should determine CF config", () => {
        const processor = determineProcessor({
            appHostId: "appHostId",
            appId: "appId",
            appName: "appName",
            appVersion: "appVersion",
            space: "spaceGuid",
            org: "orgGuid",
            sapCloudService: "sapCloudService"
        });
        expect(processor instanceof CFProcessor)
    });

});
