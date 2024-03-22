import AbapProcessor from "../../src/processors/abapProcessor.js"
import CFProcessor from "../../src/processors/cfProcessor.js";
import { determineProcessor } from "../../src/processors/processor.js"
import { expect } from "chai";

describe("Processor", () => {

    it("should determine ABAP config by type", () => {
        const processor = determineProcessor({
            type: "abap",
            destination: "abc",
            appName: "appName",
            credentials: {
                username: "env:ABAP_USERNAME",
                password: "env:ABAP_PASSWORD"
            }
        });
        expect(processor instanceof AbapProcessor);
    });

    it("should determine ABAP config by properties", () => {
        const processor = determineProcessor({
            destination: "abc",
            appName: "appName",
            credentials: {
                username: "env:ABAP_USERNAME",
                password: "env:ABAP_PASSWORD"
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
            spaceGuid: "spaceGuid",
            orgGuid: "orgGuid",
            sapCloudService: "sapCloudService"
        });
        expect(processor instanceof CFProcessor)
    });

    it("should throw error since neither CF nor ABAP config", () => {
        expect(() => determineProcessor({
            appId: "appId",
            appName: "appName",
            appVersion: "appVersion",
            spaceGuid: "spaceGuid",
            orgGuid: "orgGuid",
            sapCloudService: "sapCloudService"
        })).to.throw("ui5.yaml configuration should correspond either ABAP or SAP BTP landscape");
    });

    it("should throw error since type is not corresponding the properties", () => {
        expect(() => determineProcessor({
            type: "abap",
            appId: "appId",
            appName: "appName",
            appVersion: "appVersion",
            spaceGuid: "spaceGuid",
            orgGuid: "orgGuid",
            sapCloudService: "sapCloudService"
        })).to.throw("'destination' should be specified in ui5.yaml configuration");
    });

});
