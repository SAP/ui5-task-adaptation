import { expect } from "chai";
import sinon from "sinon";
import CFUtil from "../../../src/util/cfUtil.js";
import { enhanceRoutes, enhanceRoutesWithEndpointAndService } from "../../../src/util/cf/xsAppJsonUtil.js";
import { ServiceCredentials } from "../../../src/model/types.js";
import XsAppJsonEnhanceRoutesCommand from "../../../src/adapters/commands/xsAppJsonEnhanceRoutesCommand.js";
import UpdateCloudPlatformCommand from "../../../src/adapters/commands/updateCloudPlatformCommand.js";

describe("CFProcessor", () => {

    let cfUtilStub: sinon.SinonStub;

    beforeEach(() => {
        cfUtilStub = sinon.stub(CFUtil, "getOrCreateServiceKeyWithEndpoints");
    });

    afterEach(() => {
        sinon.restore();
    });

    it("should not update oAuthScopes if empty", async () => {
        const manifest = { "sap.platform.cf": {} };
        new UpdateCloudPlatformCommand(undefined).execute(manifest);
        expect(manifest["sap.platform.cf"]).to.be.empty;
    });

    it("should not update oAuthScopes if no sap.platform.cf", async () => {
        const manifest = {} as any;
        new UpdateCloudPlatformCommand(undefined).execute(manifest);
        expect(manifest["sap.platform.cf"]).to.be.undefined;
    });

    it("should update oAuthScopes if having $XSAPPNAME.", async () => {
        const manifest = {
            "sap.platform.cf": {
                oAuthScopes: [
                    "$XSAPPNAME.scope1"
                ]
            },
            "sap.cloud": {
                service: "testService"
            }
        };
        new UpdateCloudPlatformCommand(undefined).execute(manifest);
        expect(manifest["sap.platform.cf"].oAuthScopes[0]).to.eql("$XSAPPNAME('testService').scope1");
    });

    it("should not update oAuthScopes if not having sap.cloud/service", async () => {
        const manifest = {
            "sap.platform.cf": {
                oAuthScopes: [
                    "$XSAPPNAME.scope1"
                ]
            }
        };
        new UpdateCloudPlatformCommand(undefined).execute(manifest);
        expect(manifest["sap.platform.cf"].oAuthScopes[0]).to.eql("$XSAPPNAME.scope1");
    });

    it("should not update oAuthScopes if not having $XSAPPNAME.", async () => {
        const manifest = {
            "sap.platform.cf": {
                oAuthScopes: [
                    "scope1"
                ]
            },
            "sap.cloud": {
                service: "testService"
            }
        };
        new UpdateCloudPlatformCommand(undefined).execute(manifest);
        expect(manifest["sap.platform.cf"].oAuthScopes[0]).to.eql("scope1");
    });

    it("should update sap.cloud", async () => {
        const manifest = {
            "sap.cloud": {
                service: "testService"
            }
        };
        new UpdateCloudPlatformCommand("sapCloudService1").execute(manifest);
        expect(manifest["sap.cloud"].service).to.eql("sapCloudService1");
    });

    it("should create sap.cloud", async () => {
        const manifest = {} as any;
        new UpdateCloudPlatformCommand("sapCloudService1").execute(manifest);
        expect(manifest["sap.cloud"].service).to.eql("sapCloudService1");
    });

    it("should delete sap.cloud", async () => {
        const manifest = {
            "sap.cloud": {
                service: "testService"
            }
        };
        new UpdateCloudPlatformCommand(undefined).execute(manifest);
        expect(manifest["sap.cloud"]).to.be.undefined
    });

    describe("updateXsAppJson", () => {
        it("should skip xs-app.json update if there are no routes", async () => {
            const result = enhanceRoutesWithEndpointAndService("{}", {} as any);
            expect(result).to.eql("{}");
            expect(cfUtilStub.notCalled).to.be.true;
        });

        it("should skip xs-app.json update if there are no routes with destination", async () => {
            const routes = [
                { source: "/foo", authenticationType: "none" },
                { source: "/bar", authenticationType: "none" }
            ];
            const routesString = JSON.stringify({ routes })
            const result = enhanceRoutesWithEndpointAndService(routesString, {} as any);
            expect(result).to.eql(routesString);
            expect(cfUtilStub.notCalled).to.be.true;
        });

        it("should throw error when serviceInstanceName is not provided", async () => {
            const processor = new XsAppJsonEnhanceRoutesCommand({
                appName: "test-app"
                // serviceInstanceName is missing
            });
            const baseAppFiles = new Map<string, string>();
            // Add a route with destination to trigger the error
            baseAppFiles.set("xs-app.json", JSON.stringify({
                routes: [{ source: "/api", destination: "api-dest" }]
            }));

            await expect(processor.execute(baseAppFiles))
                .to.be.rejectedWith("Service instance name must be specified in ui5.yaml configuration for app 'test-app'");
        });

        it("should throw error when CFUtil.getOrCreateServiceKeyWithEndpoints fails", async () => {
            cfUtilStub.rejects(new Error("Service not found"));

            const processor = new XsAppJsonEnhanceRoutesCommand({
                appName: "test-app",
                serviceInstanceName: "test-service-instance"
            });
            const baseAppFiles = new Map<string, string>();
            // Add a route with destination to trigger the service key function call
            baseAppFiles.set("xs-app.json", JSON.stringify({
                routes: [{ source: "/api", destination: "api-dest" }]
            }));

            await expect(processor.execute(baseAppFiles))
                .to.be.rejectedWith("Failed to get valid service keys for app 'test-app': Service not found");
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

            cfUtilStub.resolves(mockServiceCredentials);

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

            const processor = new XsAppJsonEnhanceRoutesCommand({
                appName: "test-app",
                serviceInstanceName: "test-service-instance"
            });
            const baseAppFiles = new Map<string, string>();
            baseAppFiles.set("xs-app.json", JSON.stringify(originalXsAppJson));
            await processor.execute(baseAppFiles);
            const updatedXsAppJson = JSON.parse(baseAppFiles.get("xs-app.json")!);
            expect(updatedXsAppJson.routes).to.deep.equal(expectedXsAppJson.routes);
        });

        it("should generate unique service key name when creating new keys", async () => {
            const mockServiceCredentials = {
                endpoints: {
                    "api-endpoint": {
                        destination: "test-destination",
                        url: "https://api.example.com"
                    }
                },
                "sap.cloud.service": "test-cloud-service"
            };

            cfUtilStub.resolves(mockServiceCredentials);

            // Stub the generateUniqueServiceKeyName method
            const generateUniqueStub = sinon
                .stub(CFUtil, "generateUniqueServiceKeyName")
                .resolves("test-service-instance-key-5");

            const processor = new XsAppJsonEnhanceRoutesCommand({
                appName: "test-app",
                serviceInstanceName: "test-service-instance"
            });
            const baseAppFiles = new Map<string, string>();
            // Add a route with destination to trigger the service key function call
            baseAppFiles.set("xs-app.json", JSON.stringify({
                routes: [{ source: "/api", destination: "api-dest" }]
            }));

            await processor.execute(baseAppFiles);

            // Verify that getOrCreateServiceKeyWithEndpoints was called with the service instance name and space
            expect(cfUtilStub.calledWith("test-service-instance", undefined)).to.be.true;

            generateUniqueStub.restore();
        });
    });

    describe("enhanceRoutesWithEndpointAndService", () => {

        it("should enhance routes with endpoint information", () => {
            const serviceCredentials = {
                endpoints: {
                    "api-endpoint": {
                        destination: "api-dest"
                    },
                    "ui-endpoint": {
                        destination: "ui-dest"
                    }
                },
                "sap.cloud.service": "test-service"
            };

            const originalRoutes = [
                {
                    source: "/api/(.*)",
                    destination: "api-dest",
                    authenticationType: "xsuaa"
                },
                {
                    source: "/other/(.*)",
                    destination: "other-dest",
                    authenticationType: "none"
                },
                {
                    source: "/xsuaa/(.*)",
                    destination: "xsuaa-dest",
                    authenticationType: "none"
                }
            ];

            const expectedRoutes = [
                {
                    source: "/api/(.*)",
                    endpoint: "api-endpoint",
                    service: "test-service",
                    authenticationType: "xsuaa"
                },
                {
                    source: "/other/(.*)",
                    destination: "other-dest",
                    authenticationType: "none"
                },
                {
                    source: "/xsuaa/(.*)",
                    destination: "xsuaa-dest",
                    authenticationType: "none"
                }
            ];

            const result = enhanceRoutes(serviceCredentials, originalRoutes);

            expect(result).to.deep.equal(expectedRoutes);
        });

        it("should not map if endpoint is a simple or empty string", () => {
            const serviceCredentials = {
                endpoints: {
                    "api-endpoint": { destination: "api-dest" },
                    "view-endpoint": { destination: "" },
                    "ui-endpoint": "ui-dest"
                },
                "sap.cloud.service": "test-service"
            } as ServiceCredentials;

            const originalRoutes = [
                {
                    source: "/api/(.*)",
                    destination: "api-dest",
                    authenticationType: "xsuaa"
                },
                {
                    source: "/ui/(.*)",
                    destination: "ui-dest",
                    authenticationType: "none"
                },
                {
                    source: "/view/(.*)",
                    destination: "view-dest",
                    authenticationType: "none"
                }
            ];

            // Should not map endpoint or service for the simple string endpoint
            const expectedRoutes = [
                {
                    source: "/api/(.*)",
                    endpoint: "api-endpoint",
                    service: "test-service",
                    authenticationType: "xsuaa"
                },
                {
                    source: "/ui/(.*)",
                    destination: "ui-dest",
                    authenticationType: "none"
                },
                {
                    source: "/view/(.*)",
                    destination: "view-dest",
                    authenticationType: "none"
                }
            ];

            const result = enhanceRoutes(serviceCredentials, originalRoutes);
            expect(result).to.deep.equal(expectedRoutes);
        });

    });

    it("should not throw if no valid endpoints are provided and new key also has no endpoints", async () => {
        // Simulate CFUtil.getOrCreateServiceKeyWithEndpoints returning undefined or empty endpoints
        cfUtilStub.resolves({ endpoints: {} });

        const processor = new XsAppJsonEnhanceRoutesCommand({
            appName: "test-app",
            serviceInstanceName: "test-service-instance"
        });
        const baseAppFiles = new Map<string, string>();
        const routes = [{
            source: "/api/(.*)",
            destination: "test-destination",
            authenticationType: "xsuaa"
        }];
        baseAppFiles.set("xs-app.json", JSON.stringify({ routes }));
        baseAppFiles.set("manifest.json", "{}");

        await processor.execute(baseAppFiles);
        // xs-app.json should remain unchanged
        const updated = JSON.parse(baseAppFiles.get("xs-app.json")!);
        expect(updated.routes).to.deep.equal(routes);
    });

});
