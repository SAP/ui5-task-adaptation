import { initialize } from "../../src/landscapeConfiguration.js";
import { expect } from "chai";
import AbapAdapter from "../../src/adapters/abapAdapter.js";
import CFAdapter from "../../src/adapters/cfAdapter.js";
import { IConfiguration } from "../../src/model/configuration.js";

describe("LandscapeConfiguration", () => {

    const CF_CONFIG: IConfiguration = {
        appHostId: "appHostId",
        appId: "appId",
        appName: "appName",
        appVersion: "appVersion",
        space: "spaceGuid",
        org: "orgGuid",
        sapCloudService: "sapCloudService",
    };

    const ABAP_CONFIG: IConfiguration = {
        appName: "appName",
        target: { url: "abc" },
    };

    describe("type is specified explicitly", () => {

        it("should return CF adapter when type is 'cf'", async () => {
            const { adapter } = await initialize({ ...CF_CONFIG, type: "cf" });
            expect(adapter).to.be.instanceOf(CFAdapter);
        });

        it("should return ABAP adapter when type is 'abap'", async () => {
            const { adapter } = await initialize({ ...ABAP_CONFIG, type: "abap" });
            expect(adapter).to.be.instanceOf(AbapAdapter);
        });

    });

    describe("type is not specified — auto-detection", () => {

        it("should detect CF type", async () => {
            const { adapter } = await initialize({ ...CF_CONFIG });
            expect(adapter).to.be.instanceOf(CFAdapter);
        });

        it("should detect ABAP type", async () => {
            const { adapter } = await initialize({ ...ABAP_CONFIG });
            expect(adapter).to.be.instanceOf(AbapAdapter);
        });

        it("should throw when no validator matches", async () => {
            await expect(initialize({ appName: "appName" }))
                .to.be.rejectedWith("'type' should be specified in ui5.yaml configuration: 'cf' or 'abap'");
        });

    });

    describe("type is invalid — fallback to auto-detection", () => {

        it("should detect CF type when type is invalid", async () => {
            const { adapter } = await initialize({ ...CF_CONFIG, type: "unknown" as any });
            expect(adapter).to.be.instanceOf(CFAdapter);
        });

        it("should throw when type is invalid and no validator matches", async () => {
            await expect(initialize({ appName: "appName", type: "unknown" as any }))
                .to.be.rejectedWith("'type' should be specified in ui5.yaml configuration: 'cf' or 'abap'");
        });

    });

});
