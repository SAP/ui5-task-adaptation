import { expect } from "chai";
import XsAppJsonEnhanceRoutesCommand from "../../../../src/adapters/commands/xsAppJsonEnhanceRoutesCommand.js";
import CFUtil from "../../../../src/util/cfUtil.js";
import sinon, { SinonSandbox, SinonStub } from "sinon";
import { IReuseLibInfo, ServiceCredentials } from "../../../../src/model/types.js";
import { enhanceRoutes } from "../../../../src/util/cf/xsAppJsonUtil.js";
import ResourceUtil from "../../../../src/util/resourceUtil.js";
import FsUtil from "../../../../src/util/fsUtil.js";
import FetchPreviewResourcesCommand from "../../../../src/adapters/commands/fetchPreviewResourcesCommand.js";
import ProcessPreviewResourcesCommand from "../../../../src/adapters/commands/processPreviewResourcesCommand.js";
import { bufferToString, stringToBuffer } from "../../../../src/util/commonUtil.js";

describe("updateXsAppJson", () => {
    let cfUtilStub: sinon.SinonStub;

    beforeEach(() => {
        cfUtilStub = sinon.stub(CFUtil, "getOrCreateServiceKeyWithEndpoints");
    });

    afterEach(() => {
        sinon.restore();
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

        const command = new XsAppJsonEnhanceRoutesCommand(Promise.resolve(mockServiceCredentials));
        const baseAppFiles = new Map<string, Buffer>();
        baseAppFiles.set("xs-app.json", stringToBuffer(JSON.stringify(originalXsAppJson)));
        await command.execute(baseAppFiles);
        const updatedXsAppJson = JSON.parse(bufferToString(baseAppFiles.get("xs-app.json")!));
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

        const command = new XsAppJsonEnhanceRoutesCommand(Promise.resolve(mockServiceCredentials));
        const baseAppFiles = new Map<string, Buffer>();
        // Add a route with destination to trigger the service key function call
        baseAppFiles.set("xs-app.json", stringToBuffer(JSON.stringify({
            routes: [{ source: "/api", destination: "api-dest" }]
        })));

        await command.execute(baseAppFiles);
        generateUniqueStub.restore();
    });


    it("should not throw if no valid endpoints are provided and new key also has no endpoints", async () => {
        // Simulate CFUtil.getOrCreateServiceKeyWithEndpoints returning undefined or empty endpoints
        const command = new XsAppJsonEnhanceRoutesCommand(Promise.resolve({ endpoints: {} }));
        const baseAppFiles = new Map<string, Buffer>();
        const routes = [{
            source: "/api/(.*)",
            destination: "test-destination",
            authenticationType: "xsuaa"
        }];
        baseAppFiles.set("xs-app.json", stringToBuffer(JSON.stringify({ routes })));
        baseAppFiles.set("manifest.json", stringToBuffer("{}"));

        await command.execute(baseAppFiles);
        // xs-app.json should remain unchanged
        const updated = JSON.parse(bufferToString(baseAppFiles.get("xs-app.json")!));
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
                authenticationType: "xsuaa",
                target: "/api/target/$1"
            },
            {
                source: "/other/(.*)",
                destination: "other-dest",
                authenticationType: "none",
                target: "/api/other/$1"
            },
            {
                source: "/xsuaa/(.*)",
                destination: "xsuaa-dest",
                authenticationType: "none",
                target: "/api/xsuaa/$1"
            }
        ];

        const expectedRoutes = [
            {
                source: "/api/(.*)",
                endpoint: "api-endpoint",
                service: "test-service",
                authenticationType: "xsuaa",
                target: "/api/target/$1"
            },
            {
                source: "/other/(.*)",
                destination: "other-dest",
                authenticationType: "none",
                target: "/api/other/$1"
            },
            {
                source: "/xsuaa/(.*)",
                destination: "xsuaa-dest",
                authenticationType: "none",
                target: "/api/xsuaa/$1"
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
                authenticationType: "xsuaa",
                target: "/api/target/$1"
            },
            {
                source: "/ui/(.*)",
                destination: "ui-dest",
                authenticationType: "none",
                target: "/api/ui/$1"
            },
            {
                source: "/view/(.*)",
                destination: "view-dest",
                authenticationType: "none",
                target: "/api/view/$1"
            }
        ];

        // Should not map endpoint or service for the simple string endpoint
        const expectedRoutes = [
            {
                source: "/api/(.*)",
                endpoint: "api-endpoint",
                service: "test-service",
                authenticationType: "xsuaa",
                target: "/api/target/$1"
            },
            {
                source: "/ui/(.*)",
                destination: "ui-dest",
                authenticationType: "none",
                target: "/api/ui/$1"
            },
            {
                source: "/view/(.*)",
                destination: "view-dest",
                authenticationType: "none",
                target: "/api/view/$1"
            }
        ];

        const result = enhanceRoutes(serviceCredentials, originalRoutes);
        expect(result).to.deep.equal(expectedRoutes);
    });
});

describe("adjust xs-app.json", () => {
    let sandbox: SinonSandbox;

    const createReuseLibInfo = (overrides: Partial<Record<string, unknown>> = {}): IReuseLibInfo => ({
        name: "com.example.lib1",
        lazy: false,
        html5AppName: "lib1",
        html5AppHostId: "ddc20001-a38e-4dd2-891c-1ad50a6a7f18",
        html5AppVersion: "1.0.0",
        html5CacheBusterToken: "~047c74d4-75fe-4476-9353-4fd307b31a96~",
        url: {
            uri: "https://example.com/lib1",
            final: true
        },
        ...overrides
    });

    const createAppInfoContent = (libs: object[]) => JSON.stringify({
        "reuse.lib1": {
            asyncHints: {
                libs
            },
            messages: []
        }
    });

    const createBaseXsAppJson = () => JSON.stringify({
        "authenticationMethod": "route",
        "routes": [
            {
                "source": "^/resources/(.*)$",
                "target": "/resources/$1",
                "authenticationType": "none"
            }
        ]
    });

    const createReuseLibXsAppJson = () => JSON.stringify({
        "authenticationMethod": "route",
        "routes": [
            {
                "source": "^/resources/reuse/(.*)$",
                "target": "/resources/reuse/$1",
                "authenticationType": "basic"
            }
        ]
    });

    const createBaseFiles = (xsAppJson?: string) => {
        const baseFiles = new Map<string, Buffer>();
        if (xsAppJson) {
            baseFiles.set("xs-app.json", stringToBuffer(xsAppJson));
        }
        return baseFiles;
    };

    const createRepository = (libFiles: ReadonlyMap<string, Buffer>) => ({
        fetch: async () => libFiles
    }) as any;

    const credentials = {
        endpoints: {
            "api-endpoint": {
                destination: "ZTEST_DEST"
            }
        },
        "sap.cloud.service": "test-service"
    };

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => sandbox.restore());

    after(() => {
        delete process.env.ADP_BUILDER_MODE;
    });

    it("should adjust source path in xs-app.json", () => {
        const xsAppJson = `{
			"routes": [
				{
					"source": "^/resources/(.*)$",
					"target": "/resources/$1",
					"authenticationType": "none"
				},
				{
					"source": "^/test/(.*)$",
					"target": "/test/$1",
					"authenticationType": "none"
				}
			]
		}`;

        const fetchCommand = new FetchPreviewResourcesCommand("reuse.lib1", createRepository(new Map()));
        const adjustedXsAppJson = fetchCommand["modifyRoutes"](xsAppJson, "lib1", "com.example.lib1");

        const xsApp = JSON.parse(adjustedXsAppJson);
        expect(xsApp.routes[0].source).to.equal("^/resources/com/example/lib1/(.*)$");
        expect(xsApp.routes[0].target).to.equal("/resources/$1");
        expect(xsApp.routes[1].source).to.equal("^/resources/com/example/lib1/test/(.*)$");
        expect(xsApp.routes[1].target).to.equal("/test/$1");
    });

    it("should adjust source path in xs-app.json for html5-apps-repo-rt service", () => {
        const xsAppJson = `{
			"routes": [
				{
					"source": "^(.*)$",
					"target": "$1",
					"service": "html5-apps-repo-rt",
					"authenticationType": "xsuaa"
				}
			]
		}`;

        const fetchCommand = new FetchPreviewResourcesCommand("reuse.lib1", createRepository(new Map()));
        const adjustedXsAppJson = fetchCommand["modifyRoutes"](xsAppJson, "lib1", "com.example.lib1");

        const xsApp = JSON.parse(adjustedXsAppJson);
        expect(xsApp.routes[0].source).to.equal("^/resources/com/example/lib1/(.*)$");
        expect(xsApp.routes[0].target).to.equal("$1");
        expect(xsApp.routes[0].localDir).to.equal(".adp/reuse/lib1");
    });

    it("should merge xs-app.json files", async () => {
        const libFiles = new Map<string, Buffer>([["xs-app.json", stringToBuffer(JSON.stringify({
            "authenticationMethod": "route",
            "routes": [
                {
                    "source": "^/test/(.*)$",
                    "target": "/test/$1",
                    "authenticationType": "xsuaa",
                    "destination": "ZTEST_DEST"
                },
                {
                    "source": "^(.*)$",
                    "target": "$1",
                    "service": "html5-apps-repo-rt",
                    "authenticationType": "xsuaa"
                }
            ]
        }))]]);

        const resourceWrite = await prepareFiles([createReuseLibInfo()], libFiles, createBaseXsAppJson());

        expect(resourceWrite.called, "ResourceUtil.writeInProject should be called to write merged xs-app.json").to.be.true;
        const mergedXsAppMap = resourceWrite.getCall(0).args[1];
        const mergedXsAppJson = bufferToString(mergedXsAppMap.get("xs-app.json")!);
        const mergedXsApp = JSON.parse(mergedXsAppJson);

        expect(mergedXsApp.routes).to.deep.equal([{
            source: "^/resources/com/example/lib1/test/(.*)$",
            target: "/test/$1",
            authenticationType: "xsuaa",
            endpoint: "api-endpoint",
            service: "test-service",
        },
        {
            source: "^/resources/com/example/lib1/(.*)$",
            target: "$1",
            localDir: ".adp/reuse/lib1", // update localDir for html5-apps-repo-rt service
        },
        {
            source: "^/resources/(.*)$",
            target: "/resources/$1",
            authenticationType: "none",
        }]);
    });

    it("should merge base app xs-app.json and reuse xs-app.json to .adp/reuse", async () => {
        const resourceWrite = await prepareFiles([createReuseLibInfo()], new Map([[
            "xs-app.json", stringToBuffer(createReuseLibXsAppJson())
        ]]), createBaseXsAppJson());

        expect(resourceWrite.calledOnce, "ResourceUtil.writeInProject should be called").to.be.true;
        const writtenFiles = resourceWrite.getCall(0).args[1] as ReadonlyMap<string, Buffer>;
        const mergedXsAppJson = writtenFiles.get("xs-app.json");
        expect(mergedXsAppJson).to.not.be.undefined;
        expect(JSON.parse(bufferToString(mergedXsAppJson!))).to.deep.equal({
            authenticationMethod: "route",
            routes: [{
                authenticationType: "basic",
                source: "^/resources/com/example/lib1/reuse/(.*)$",
                target: "/resources/reuse/$1",
            },
            {
                authenticationType: "none",
                source: "^/resources/(.*)$",
                target: "/resources/$1",
            }]
        });
    });

    it("should write base app xs-app.json to .adp/reuse when no reuse libraries", async () => {
        const resourceWrite = await prepareFiles([createReuseLibInfo()], new Map(), createBaseXsAppJson());

        expect(resourceWrite.calledOnce, "ResourceUtil.writeInProject should be called").to.be.true;
        const writtenFiles = resourceWrite.getCall(0).args[1] as ReadonlyMap<string, Buffer>;
        const mergedXsAppJson = writtenFiles.get("xs-app.json");
        expect(mergedXsAppJson).to.not.be.undefined;
        expect(JSON.parse(bufferToString(mergedXsAppJson!))).to.deep.equal({
            authenticationMethod: "route",
            routes: [
                {
                    source: "^/resources/(.*)$",
                    target: "/resources/$1",
                    authenticationType: "none"
                }
            ]
        });
    });

    it("should not write xs-app.json when it is missing in base app and reuse library", async () => {
        const resourceWrite = await prepareFiles([createReuseLibInfo()]);

        expect(resourceWrite.calledOnce, "ResourceUtil.writeInProject should be called once (for Component.js)").to.be.true;
        const writtenFiles = resourceWrite.getCall(0).args[1] as ReadonlyMap<string, Buffer>;
        expect(bufferToString(writtenFiles.get("lib1/Component.js")!)).to.equal("sap.ui.define([], function() {});");
        expect(writtenFiles.has("xs-app.json")).to.be.false;
    });

    it("should not write any files when no reuse libraries and no base xs-app.json", async () => {
        const resourceWrite = await prepareFiles([]);
        expect(resourceWrite.calledOnce, "ResourceUtil.writeInProject should not be called with no files").to.be.false;
    });

    it("should await XsAppJsonEnhanceRoutesCommand before writing xs-app.json to project (regression: fire-and-forget)", async () => {
        // Regression: if processPreviewResourcesCommand.ts forgets to await
        // XsAppJsonEnhanceRoutesCommand, ResourceUtil.writeInProject is called
        // BEFORE the routes get rewritten with endpoint/service. A reference-based
        // assertion misses it because the Map gets mutated after the fact, so we
        // snapshot the xs-app.json content at the moment of writeInProject.
        const libFiles = new Map<string, Buffer>([["xs-app.json", stringToBuffer(JSON.stringify({
            authenticationMethod: "route",
            routes: [{
                source: "^/test/(.*)$",
                target: "/test/$1",
                authenticationType: "xsuaa",
                destination: "ZTEST_DEST"
            }]
        }))]]);
        const defaultReuseLibFiles = new Map<string, Buffer>([
            ["Component.js", stringToBuffer("sap.ui.define([], function() {});")],
            ...libFiles
        ]);
        const repository = createRepository(defaultReuseLibFiles);
        let xsAppJsonAtWriteTime: string | undefined;
        sandbox.stub(ResourceUtil, "writeInProject").callsFake(async (_dir: string, files: Map<string, Buffer>) => {
            // snapshot content in the very moment writeInProject is invoked
            const buffer = files.get("xs-app.json");
            xsAppJsonAtWriteTime = buffer ? bufferToString(buffer) : undefined;
            return [];
        });
        sandbox.stub(FsUtil, "readInProject").resolves(stringToBuffer(createAppInfoContent([createReuseLibInfo()])));
        // Delay service credentials so fire-and-forget enhance cannot win the race
        const slowCredentials = new Promise<ServiceCredentials>(resolve => {
            setTimeout(() => resolve(credentials), 50);
        });
        const fetchCommand = new FetchPreviewResourcesCommand("reuse.lib1", repository);
        await fetchCommand.execute();
        const processCommand = new ProcessPreviewResourcesCommand(slowCredentials, fetchCommand.result);
        await processCommand.execute(createBaseFiles(createBaseXsAppJson()));

        expect(xsAppJsonAtWriteTime, "writeInProject was not called").to.not.be.undefined;
        const written = JSON.parse(xsAppJsonAtWriteTime!);
        const enhancedRoute = written.routes.find((r: any) => r.source === "^/resources/com/example/lib1/test/(.*)$");
        expect(enhancedRoute, "route with matching destination should be enhanced").to.deep.include({
            endpoint: "api-endpoint",
            service: "test-service"
        });
        expect(enhancedRoute).to.not.have.property("destination");
    });

    async function prepareFiles(ui5AppInfoJson: IReuseLibInfo[], reuseLibFiles?: Map<string, Buffer>, xsAppJson?: string): Promise<SinonStub<[dir: string, files: Map<string, Buffer>], Promise<void[]>>> {
        const appInfoContent = createAppInfoContent(ui5AppInfoJson);
        // input for preview process: contain baseApp and appVar merged files
        const baseFiles = createBaseFiles(xsAppJson);
        const defaultReuseLibFiles = new Map<string, Buffer>();
        if (ui5AppInfoJson.length > 0) {
            defaultReuseLibFiles.set("Component.js", stringToBuffer("sap.ui.define([], function() {});"));
            reuseLibFiles?.forEach((value, key) => defaultReuseLibFiles.set(key, value));
        }
        const repository = createRepository(defaultReuseLibFiles);
        const resourceWrite = sandbox.stub(ResourceUtil, "writeInProject");
        sandbox.stub(FsUtil, "readInProject").resolves(stringToBuffer(appInfoContent));
        const fetchCommand = new FetchPreviewResourcesCommand("reuse.lib1", repository);
        await fetchCommand.execute();
        const processCommand = new ProcessPreviewResourcesCommand(Promise.resolve(credentials), fetchCommand.result);
        await processCommand.execute(baseFiles);
        const command = new XsAppJsonEnhanceRoutesCommand(Promise.resolve(credentials));
        await command.execute(baseFiles);
        return resourceWrite;
    }

});