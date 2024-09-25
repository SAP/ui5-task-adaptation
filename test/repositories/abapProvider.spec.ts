import AbapProvider from "../../src/repositories/abapProvider.js";
import { AbapServiceProvider } from "@sap-ux/axios-extension/dist/abap/abap-service-provider.js";
import esmock from "esmock";
import { expect } from "chai";

describe("AbapProvider", () => {

    afterEach(() => {
        delete process.env.H2O_URL;
    });

    it("should throw exception since destination is not available in ide", async () => {
        await expect(new AbapProvider().get({
            destination: "abc",
            appName: "app/Name"
        })).to.be.rejectedWith("Unable to handle the configuration in the current environment");
    });

    it("should accept destination in BAS", async () => {
        process.env.H2O_URL = "test";
        const AbapProvider = await mockAbapProvider({ destination: "abc" });
        await new AbapProvider().get({
            destination: "abc",
            appName: "app/Name"
        });
    });

    it("should throw error since connection with destination not present in configuration for BAS", async () => {
        process.env.H2O_URL = "test";
        const AbapProvider = await mockAbapProvider({ destination: "abc" });
        await expect(new AbapProvider().get({
            appName: "app/Name",
            target: {
                url: "example.com"
            }
        })).to.be.rejectedWith("'destination' should be specified in ui5.yaml configuration/target");
    });

    it("should throw error since connection with url not present in configuration for IDE", async () => {
        const AbapProvider = await mockAbapProvider({ destination: "abc" });
        await expect(new AbapProvider().get({
            appName: "app/Name",
            target: {
                destination: "abc"
            }
        })).to.be.rejectedWith("'url' should be specified in ui5.yaml configuration/target");
    });

    it("should use url in IDE with both target and destination", async () => {
        const AbapProvider = await mockAbapProvider({ url: "example.com" });
        await new AbapProvider().get({
            destination: "abc",
            appName: "app/Name",
            target: {
                url: "example.com"
            }
        });
    });

    it("should use destination in BAS with both target and destination", async () => {
        process.env.H2O_URL = "test";
        const AbapProvider = await mockAbapProvider({ destination: "abc" });
        await new AbapProvider().get({
            destination: "abc",
            appName: "app/Name",
            target: {
                destination: "abc"
            }
        });
    });

});

async function mockAbapProvider(expected: any) {
    return esmock("../../src/repositories/abapProvider.js", {}, {
        "@sap-ux/system-access": {
            createAbapServiceProvider: (abapconnection: any) => {
                expect(abapconnection).to.eql(expected);
                return new AbapServiceProvider();
            }
        }
    });
}
