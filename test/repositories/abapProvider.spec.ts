import AbapProvider from "../../src/repositories/abapProvider.js";
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
            connections: [{
                url: "example.com"
            }]
        })).to.be.rejectedWith("ABAP connection settings should be specified in ui5.yaml configuration");
    });

    it("should throw error since connection with url not present in configuration for IDE", async () => {
        const AbapProvider = await mockAbapProvider({ destination: "abc" });
        await expect(new AbapProvider().get({
            appName: "app/Name",
            connections: [{
                destination: "abc"
            }]
        })).to.be.rejectedWith("ABAP connection settings should be specified in ui5.yaml configuration");
    });

    it("should accept connection with destination in BAS", async () => {
        process.env.H2O_URL = "test";
        const AbapProvider = await mockAbapProvider({ destination: "abc" });
        new AbapProvider().get({
            appName: "app/Name",
            connections: [
                {
                    destination: "abc"
                },
                {
                    url: "example.com"
                }
            ]
        });
    });

    it("should accept connection with destination in IDE", async () => {
        const AbapProvider = await mockAbapProvider({ url: "example.com" });
        new AbapProvider().get({
            appName: "app/Name",
            connections: [
                {
                    destination: "abc"
                },
                {
                    url: "example.com"
                }
            ]
        });
    });

    it("should throw error in IDE with both connections and destination", async () => {
        const AbapProvider = await mockAbapProvider({ url: "example.com" });
        await expect(new AbapProvider().get({
            destination: "abc",
            appName: "app/Name",
            connections: [{
                url: "example.com"
            }]
        })).to.be.rejectedWith("Either destination or connections should be presented in configuration, not both");
    });

    it("should throw error in BAS with both connections and destination", async () => {
        process.env.H2O_URL = "test";
        const AbapProvider = await mockAbapProvider({ destination: "abc" });
        await expect(new AbapProvider().get({
            destination: "abc",
            appName: "app/Name",
            connections: [{
                url: "example.com"
            }]
        })).to.be.rejectedWith("ABAP connection settings should be specified in ui5.yaml configuration");
    });

});

async function mockAbapProvider(expected: any) {
    return esmock("../../src/repositories/abapProvider.js", {}, {
        "@sap-ux/system-access": {
            createAbapServiceProvider: (abapconnection: any) => {
                expect(abapconnection).to.eql(expected);
            }
        }
    });
}
