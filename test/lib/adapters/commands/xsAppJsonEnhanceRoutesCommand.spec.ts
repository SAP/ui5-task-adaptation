import { expect } from "chai";
import XsAppJsonEnhanceRoutesCommand from "../../../../src/adapters/commands/xsAppJsonEnhanceRoutesCommand.js";
import CFUtil from "../../../../src/util/cfUtil.js";
import sinon from "sinon";
import { ServiceCredentials } from "../../../../src/model/types.js";
import { enhanceRoutes } from "../../../../src/util/cf/xsAppJsonUtil.js";

describe("updateXsAppJson", () => {
    let cfUtilStub: sinon.SinonStub;

    beforeEach(() => {
        cfUtilStub = sinon.stub(CFUtil, "getOrCreateServiceKeyWithEndpoints");
    });

    afterEach(() => {
        sinon.restore();
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