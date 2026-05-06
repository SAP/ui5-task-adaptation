import * as chai from "chai";

import { enhanceRoutesWithEndpointAndService, merge } from "../../../../src/util/cf/xsAppJsonUtil.js";
import XsAppJsonEnhanceRoutesCommand from "../../../../src/adapters/commands/xsAppJsonEnhanceRoutesCommand.js";

const { expect } = chai;

describe("xsAppJsonUtil.merge", () => {
    it("returns undefined for empty input", () => {
        const result = merge([]);
        expect(result).to.be.undefined;
    });

    it("returns same content for single input", () => {
        const singleObj = { authenticationMethod: "route", routes: [] };
        const single = JSON.stringify(singleObj);
        const result = merge([single]);
        expect(result).to.be.a("string");
        expect(JSON.parse(result!)).to.deep.equal(singleObj);
    });

    it("merges multiple xs-app.json contents: first welcomeFile/authMethod, concatenated routes", () => {
        const appVariant = JSON.stringify({
            welcomeFile: "/variant/",
            authenticationMethod: "route",
            routes: [
                { source: "^/variant/(.*)$", target: "/$1", destination: "v" }
            ]
        });
        const reuseLib = JSON.stringify({
            authenticationMethod: "none",
            routes: [
                { source: "^/lib/(.*)$", target: "/$1", destination: "l" }
            ]
        });
        const baseApp = JSON.stringify({
            welcomeFile: "/base/",
            authenticationMethod: "route",
            routes: [
                { source: "^/resources/(.*)$", target: "/resources/$1", destination: "ui5" }
            ]
        });

        const result = merge([appVariant, reuseLib, baseApp]);
        expect(result).to.be.a("string");
        const merged = JSON.parse(result!);
        const expected = {
            welcomeFile: "/variant/",
            authenticationMethod: "route",
            routes: [{
                source: "^/variant/(.*)$",
                target: "/$1",
                destination: "v"
            },
            {
                source: "^/lib/(.*)$",
                target: "/$1",
                destination: "l"
            },
            {
                source: "^/resources/(.*)$",
                target: "/resources/$1",
                destination: "ui5"
            }]
        };
        expect(merged).to.deep.equal(expected);
    });

    it("should skip xs-app.json update if there are no routes", async () => {
        const result = enhanceRoutesWithEndpointAndService("{}", {} as any);
        expect(result).to.eql("{}");
    });

    it("should skip xs-app.json update if there are no routes with destination", async () => {
        const routes = [
            { source: "/foo", authenticationType: "none" },
            { source: "/bar", authenticationType: "none" }
        ];
        const routesString = JSON.stringify({ routes })
        const result = enhanceRoutesWithEndpointAndService(routesString, {} as any);
        expect(result).to.eql(routesString);
    });
});

describe("xsAppJsonUtil.enhanceRoutesWithEndpointAndService", () => {
    it("should skip xs-app.json update if there are no routes", async () => {
        expect(enhanceRoutesWithEndpointAndService("{}", {} as any)).to.eql("{}");
    });

    it("should skip xs-app.json update if there are no routes with destination", async () => {
        const routes = [
            { source: "/foo", authenticationType: "none" },
            { source: "/bar", authenticationType: "none" }
        ];
        const routesString = JSON.stringify({ routes })
        expect(enhanceRoutesWithEndpointAndService(routesString, {} as any)).to.eql(routesString);
    });

    it("should enhance routes with endpoint and service information", async () => {
        const mockServiceCredentials = {
            endpoints: {
                "api-endpoint": {
                    destination: "test-destination",
                    url: "https://api.example.com"
                },
                "ui-endpoint": {
                    destination: "ui-destination",
                    url: "https://ui.example.com"
                }
            },
            "sap.cloud.service": "test-cloud-service"
        };

        const originalXsAppJson = {
            routes: [
                {
                    source: "/api/(.*)",
                    destination: "test-destination",
                    authenticationType: "xsuaa"
                },
                {
                    source: "/ui/(.*)",
                    destination: "ui-destination",
                    authenticationType: "none"
                },
                {
                    source: "/other/(.*)",
                    destination: "other-destination",
                    authenticationType: "none"
                }
            ]
        };

        const expectedXsAppJson = {
            routes: [
                {
                    source: "/api/(.*)",
                    endpoint: "api-endpoint",
                    service: "test-cloud-service",
                    authenticationType: "xsuaa"
                },
                {
                    source: "/ui/(.*)",
                    endpoint: "ui-endpoint",
                    service: "test-cloud-service",
                    authenticationType: "none"
                },
                {
                    source: "/other/(.*)",
                    destination: "other-destination",
                    authenticationType: "none"
                }
            ]
        };

        const command = new XsAppJsonEnhanceRoutesCommand(
            Promise.resolve(mockServiceCredentials)
        );
        const baseAppFiles = new Map<string, string>();
        baseAppFiles.set("xs-app.json", JSON.stringify(originalXsAppJson));
        await command.execute(baseAppFiles);
        const updatedXsAppJson = JSON.parse(baseAppFiles.get("xs-app.json")!);
        expect(updatedXsAppJson.routes).to.deep.equal(expectedXsAppJson.routes);
    });
});
