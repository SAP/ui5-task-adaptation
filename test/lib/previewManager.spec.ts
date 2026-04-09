import PreviewManager from "../../src/previewManager.js";
import esmock from "esmock";
import ResourceUtil from "../../src/util/resourceUtil.js";
import { assert, expect } from "chai";
import * as sinon from "sinon";
import { SinonSandbox, SinonStub } from "sinon";
import FsUtil from "../../src/util/fsUtil.js";
import { IConfiguration, IReuseLibInfo } from "../../src/model/types.js";
import CFUtil from "../../src/util/cfUtil.js";


const configuration = {
	appName: "testApp",
	serviceInstanceName: "testService",
	space: "testSpace"
} as IConfiguration;


describe("PreviewManager download reuse libraries", () => {
	let sandbox: SinonSandbox;

	beforeEach(() => {
		sandbox = sinon.createSandbox();
		process.env.ADP_BUILDER_MODE = "preview";
		sandbox.stub(CFUtil, "getOrCreateServiceKeyWithEndpoints").resolves({
			endpoints: {
				"api-endpoint": {
					destination: "ZTEST_DEST"
				}
			},
			"sap.cloud.service": "test-service"
		});
	});

	afterEach(() => sandbox.restore());

	after(() => {
		delete process.env.ADP_BUILDER_MODE;
	});

	it("should check if download of libs is requested", () => {
		expect(PreviewManager["isPreviewRequested"]()).to.be.true;

		delete process.env.ADP_BUILDER_MODE;
		expect(PreviewManager["isPreviewRequested"]()).to.be.false;
	});

	it("should read ui5AppInfo.js and find reuse libs to download", async () => {
		const appInfo = JSON.stringify({
			"reuse.lib1": {
				asyncHints: {
					libs: [
						{
							html5AppName: "lib1",
							html5AppHostId: "ddc20001-a38e-4dd2-891c-1ad50a6a7f18",
							html5AppVersion: "1.0.0",
							html5CacheToken: "~047c74d4-75fe-4476-9353-4fd307b31a96~",
							url: {
								final: "https://example.com/lib1"
							}
						},
						{
							html5AppName: "lib2",
							html5AppHostId: "ddc20001-a38e-4dd2-891c-1ad50a6a7f18",
							html5AppVersion: "1.0.0",
							html5CacheToken: "~047c74d4-75fe-4476-9353-4fd307b31a96~",
							url: {
								final: "https://example.com/lib2"
							}
						}
					]
				},
				messages: []
			}
		});

		const processorStub = {
			fetchReuseLib: async (_: string) => []
		} as any;

		sandbox.stub(FsUtil, "readInProject").returns(Promise.resolve(appInfo));

		const previewManager = await PreviewManager.createFromRoot("reuse.lib1", processorStub, configuration);
		expect(previewManager["fetchLibsPromises"].size > 0).to.be.true;
	});

	it("should raise an error if ui5AppInfo.json is missing", async () => {
		const files = new Map<string, string>();
		try {
			sandbox.stub(ResourceUtil, "byGlobInProject").returns(Promise.resolve(files));

			await PreviewManager.createFromRoot("reuse.lib1", {} as any, configuration);
			assert.fail(true, false, "Exception not thrown");
		} catch (error: any) {
			expect(error.message).to.match(/ui5AppInfo\.json is missing in project root, cannot process preview resources: ENOENT: no such file or directory, open '.*ui5AppInfo\.json'/);
		}
	});

	it("should read ui5AppInfo.json and find no reuse libs to download", async () => {
		const appInfoContent = JSON.stringify({
			"reuse.lib1": {
				asyncHints: {
					libs: []
				},
				messages: []
			}
		});
		const processorStub = {
			fetchReuseLib: async () => new Map<string, string>()
		} as any;
		sandbox.stub(FsUtil, "readInProject").returns(Promise.resolve(appInfoContent));

		const previewManager = await PreviewManager.createFromRoot("reuse.lib1", processorStub, configuration);
		expect(previewManager["fetchLibsPromises"].size > 0).to.be.false;
	});

	it("should download reuse libs and move them to preview folder", async () => {
		const writeStub = sandbox.stub(ResourceUtil, "writeInProject");

		const appInfoContent = JSON.stringify({
			"reuse.lib1": {
				asyncHints: {
					libs: [
						{
							html5AppName: "lib1",
							html5AppHostId: "ddc20001-a38e-4dd2-891c-1ad50a6a7f18",
							html5AppVersion: "1.0.0",
							html5CacheToken: "~047c74d4-75fe-4476-9353-4fd307b31a96~",
							url: {
								final: "https://example.com/lib1"
							}
						},
						{
							html5AppName: "lib2",
							html5AppHostId: "ddc20001-a38e-4dd2-891c-1ad50a6a7f18",
							html5AppVersion: "1.0.0",
							html5CacheToken: "~047c74d4-75fe-4476-9353-4fd307b31a96~",
							url: {
								final: "https://example.com/lib2"
							}
						}
					]
				},
				messages: []
			}
		});

		const processor = {
			fetchReuseLib: async () => {
				const libFiles = new Map<string, string>();
				libFiles.set("file1.js", "console.log('file1');");
				libFiles.set("file2.js", "console.log('file2');");
				return libFiles;
			}
		} as any;

		sandbox.stub(FsUtil, "readInProject").returns(Promise.resolve(appInfoContent));

		const previewManager = await PreviewManager.createFromRoot("reuse.lib1", processor, configuration);
		await previewManager.processPreviewResources(new Map<string, string>([["xs-app.json", "{}"]]));

		const allFiles = writeStub.getCall(0).args[1] as ReadonlyMap<string, string>;
		expect(allFiles.size).to.equal(5);
		expect(allFiles.has("lib1/file1.js")).to.be.true;
		expect(allFiles.has("lib1/file2.js")).to.be.true;
		expect(allFiles.has("lib2/file1.js")).to.be.true;
		expect(allFiles.has("lib2/file2.js")).to.be.true;
		expect(allFiles.has("xs-app.json")).to.be.true;
	});

	it("should log warn with 'No files found in reuse library ...' message", async () => {
		const warnSpy = sandbox.spy();
		const writeStub = sandbox.stub(ResourceUtil, "writeInProject");

		const PreviewManagerMock: typeof PreviewManager = await esmock(
			"../../src/previewManager.js",
			{
				"@ui5/logger": {
					getLogger: () => ({
						warn: warnSpy,
						verbose: () => { },
						info: () => { },
						error: () => { }
					})
				}
			}
		) as any;

		const appInfoContent = JSON.stringify({
			"reuse.libEmpty": {
				asyncHints: {
					libs: [
						{
							name: "com.example.libEmpty",
							html5AppName: "libEmpty",
							html5AppHostId: "ddc20001-a38e-4dd2-891c-1ad50a6a7f18",
							html5AppVersion: "1.0.0",
							html5CacheToken: "~047c74d4-75fe-4476-9353-4fd307b31a96~",
							url: { final: "https://example.com/libEmpty" }
						}
					]
				},
				messages: []
			}
		});

		const processorStub = {
			fetchReuseLib: async () => new Map<string, string>()
		} as any;

		sandbox.stub(FsUtil, "readInProject").returns(Promise.resolve(appInfoContent));

		const previewManager = await PreviewManagerMock.createFromRoot("reuse.libEmpty", processorStub, configuration);
		await previewManager.processPreviewResources(new Map<string, string>([["xs-app.json", "{}"]]));

		expect(warnSpy.called).to.be.true;
		expect(warnSpy.calledWithMatch(/No files found in reuse library libEmpty for preview/)).to.be.true;
		expect(writeStub.called).to.be.true;
	});
});

describe("PreviewManager adjust xs-app.json", () => {
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
		const baseFiles = new Map<string, string>();
		if (xsAppJson) {
			baseFiles.set("xs-app.json", xsAppJson);
		}
		return baseFiles;
	};

	const createProcessor = (libFiles: ReadonlyMap<string, string>) => ({
		fetchReuseLib: async () => libFiles
	}) as any;

	const createPreviewManager = async (appInfoContent: string, processor: any) => {
		sandbox.stub(FsUtil, "readInProject").returns(Promise.resolve(appInfoContent));
		return PreviewManager.createFromRoot("reuse.lib1", processor, configuration);
	};

	beforeEach(() => {
		sandbox = sinon.createSandbox();
		process.env.ADP_BUILDER_MODE = "preview";
		sandbox.stub(CFUtil, "getOrCreateServiceKeyWithEndpoints").resolves({
			endpoints: {
				"api-endpoint": {
					destination: "ZTEST_DEST"
				}
			},
			"sap.cloud.service": "test-service"
		});
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

		const adjustedXsAppJson = PreviewManager["modifyRoutes"](xsAppJson, "lib1", "com.example.lib1");

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

		const adjustedXsAppJson = PreviewManager["modifyRoutes"](xsAppJson, "lib1", "com.example.lib1");

		const xsApp = JSON.parse(adjustedXsAppJson);
		expect(xsApp.routes[0].source).to.equal("^/resources/com/example/lib1/(.*)$");
		expect(xsApp.routes[0].target).to.equal("$1");
		expect(xsApp.routes[0].localDir).to.equal(".adp/reuse/lib1");
	});

	it("should merge xs-app.json files", async () => {
		const libFiles = new Map<string, string>([["xs-app.json", JSON.stringify({
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
		})]]);

		const resourceWrite = await prepareFiles([createReuseLibInfo()], libFiles, createBaseXsAppJson());

		expect(resourceWrite.called, "ResourceUtil.writeInProject should be called to write merged xs-app.json").to.be.true;
		const mergedXsAppMap = resourceWrite.getCall(0).args[1];
		const mergedXsAppJson = mergedXsAppMap.get("xs-app.json")!;
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
			"xs-app.json", createReuseLibXsAppJson()
		]]), createBaseXsAppJson());

		expect(resourceWrite.calledOnce, "ResourceUtil.writeInProject should be called").to.be.true;
		const writtenFiles = resourceWrite.getCall(0).args[1] as ReadonlyMap<string, string>;
		const mergedXsAppJson = writtenFiles.get("xs-app.json");
		expect(mergedXsAppJson).to.not.be.undefined;
		expect(JSON.parse(mergedXsAppJson!)).to.deep.equal({
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
		const writtenFiles = resourceWrite.getCall(0).args[1] as ReadonlyMap<string, string>;
		const mergedXsAppJson = writtenFiles.get("xs-app.json");
		expect(mergedXsAppJson).to.not.be.undefined;
		expect(JSON.parse(mergedXsAppJson!)).to.deep.equal({
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
		const writtenFiles = resourceWrite.getCall(0).args[1] as ReadonlyMap<string, string>;
		expect(writtenFiles.get("lib1/Component.js")).to.equal("sap.ui.define([], function() {});");
		expect(writtenFiles.has("xs-app.json")).to.be.false;
	});

	it("should not write any files when no reuse libraries and no base xs-app.json", async () => {
		const resourceWrite = await prepareFiles([]);
		expect(resourceWrite.calledOnce, "ResourceUtil.writeInProject should not be called with no files").to.be.false;
	});

	async function prepareFiles(ui5AppInfoJson: IReuseLibInfo[], reuseLibFiles?: Map<string, string>, xsAppJson?: string): Promise<SinonStub<[dir: string, files: Map<string, string>], Promise<void[]>>> {
		const appInfoContent = createAppInfoContent(ui5AppInfoJson);
		// input for preview process: contain baseApp and appVar merged files
		const baseFiles = createBaseFiles(xsAppJson);
		const defaultReuseLibFiles = new Map<string, string>();
		if (ui5AppInfoJson.length > 0) {
			defaultReuseLibFiles.set("Component.js", "sap.ui.define([], function() {});");
			reuseLibFiles?.forEach((value, key) => defaultReuseLibFiles.set(key, value));
		}
		const processor = createProcessor(defaultReuseLibFiles);

		const resourceWrite = sandbox.stub(ResourceUtil, "writeInProject");
		const previewManager = await createPreviewManager(appInfoContent, processor);
		await previewManager.processPreviewResources(baseFiles);
		return resourceWrite;
	}

});
