import { expect } from "chai";
import sinon, { SinonSandbox } from "sinon";
import PreviewAdapter from "../../../src/adapters/previewAdapter.js";
import FsUtil from "../../../src/util/fsUtil.js";
import ResourceUtil from "../../../src/util/resourceUtil.js";
import { REUSE_DIR } from "../../../src/model/configuration.js";
import { UI5BuilderTools } from "../../../src/model/types.js";
import CFUtil from "../../../src/util/cfUtil.js";
import AppVariant from "../../../src/appVariant.js";
import TaskUtil from "@ui5/project/build/helpers/TaskUtil";


describe("PreviewAdapter preview resources", () => {
    let sandbox: SinonSandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    it("fetches and processes reuse libs through command chains", async () => {
        const appInfoContent = JSON.stringify({
            "reuse.lib1": {
                asyncHints: {
                    libs: [
                        {
                            name: "com.example.lib1",
                            html5AppName: "lib1",
                            html5AppHostId: "ddc20001-a38e-4dd2-891c-1ad50a6a7f18",
                            html5AppVersion: "1.0.0",
                            html5CacheToken: "~047c74d4-75fe-4476-9353-4fd307b31a96~",
                            url: {
                                final: "https://example.com/lib1"
                            }
                        }
                    ]
                },
                messages: []
            }
        });

        const baseXsAppJson = JSON.stringify({
            authenticationMethod: "route",
            routes: [
                {
                    source: "^/resources/(.*)$",
                    target: "/resources/$1",
                    authenticationType: "none"
                }
            ]
        });

        const libXsAppJson = JSON.stringify({
            authenticationMethod: "route",
            routes: [
                {
                    source: "^/test/(.*)$",
                    target: "/test/$1",
                    authenticationType: "xsuaa"
                }
            ]
        });

        const repositoryStub = {
            fetch: async () => new Map<string, string>([
                ["xs-app.json", libXsAppJson],
                ["file1.js", "console.log('file1');"],
                ["file2.js", "console.log('file2');"]
            ])
        } as any;

        sandbox.stub(FsUtil, "readInProject").resolves(appInfoContent);
        sandbox.stub(CFUtil, "getOrCreateServiceKeyWithEndpoints").resolves({
            endpoints: {
                "api-endpoint": { destination: "ZTEST_DEST" },
                "view-endpoint": { destination: "" },
                "ui-endpoint": "ui-dest"
            },
            "sap.cloud.service": "test-service"
        });
        const writeInProjectStub = sandbox.stub(ResourceUtil, "writeInProject").resolves();

        const adapter = new PreviewAdapter({
            serviceInstanceName: "my-service",
        });
        const setupChain = adapter.createSetupCommandChain("reuse.lib1", repositoryStub);
        await setupChain.execute();

        const references = new Map<string, string>();
        const adaptationProject = {
            movedFiles: new Map<string, string>(),
            resources: []
        } as any;

        const ui5BuilderTools = {
            workspace: {
                write: sandbox.stub().resolves()
            } as unknown as IWorkspace,
            taskUtil: {
                setTag: sandbox.stub(),
                STANDARD_TAGS: { OmitFromBuildResult: "OmitFromBuildResult" }
            } as unknown as TaskUtil,
            projectNamespace: "projectNamespace"
        } as UI5BuilderTools;
        const postChain = adapter.createPostCommandChain(references, adaptationProject, ui5BuilderTools);
        const baseFiles = new Map<string, string>([["xs-app.json", baseXsAppJson]]);
        await postChain.execute(baseFiles);

        expect(writeInProjectStub.calledOnce).to.be.true;
        expect(writeInProjectStub.getCall(0).args[0]).to.equal(REUSE_DIR);

        const writtenFiles = writeInProjectStub.getCall(0).args[1] as ReadonlyMap<string, string>;
        expect(writtenFiles.has("lib1/file1.js")).to.be.true;
        expect(writtenFiles.has("lib1/file2.js")).to.be.true;
        expect(writtenFiles.has("xs-app.json")).to.be.true;

        const mergedXsAppJson = JSON.parse(writtenFiles.get("xs-app.json")!);
        expect(mergedXsAppJson.authenticationMethod).to.equal("route");
        expect(mergedXsAppJson.routes.length).to.equal(2);
        expect(mergedXsAppJson.routes[0].source).to.equal("^/resources/com/example/lib1/test/(.*)$");
        expect(mergedXsAppJson.routes[0].target).to.equal("/test/$1");
        expect(mergedXsAppJson.routes[1].source).to.equal("^/resources/(.*)$");
        expect(mergedXsAppJson.routes[1].target).to.equal("/resources/$1");
        it("should enhance xs-app.json routes with endpoint and service", async () => {
            const adapter = new PreviewAdapter({
                serviceInstanceName: "my-service",
                appName: "my-app",
                space: "my-space"
            });

            sandbox.stub(CFUtil, "getOrCreateServiceKeyWithEndpoints").resolves({
                endpoints: {
                    "api-endpoint": {
                        destination: "ZTEST_DEST"
                    }
                },
                "sap.cloud.service": "test-service"
            });

            const files = new Map<string, string>([
                ["xs-app.json", JSON.stringify({
                    routes: [{
                        source: "^/sap/opu/odata/sap/ZTEST_SRV/",
                        target: "/sap/opu/odata/sap/ZTEST_SRV/",
                        authenticationType: "basic",
                        destination: "OVERRIDE"
                    }, {
                        source: "^/sap/opu/odata/sap/ZTEST_SRV/",
                        target: "/sap/opu/odata/sap/ZTEST_SRV/",
                        authenticationType: "none",
                        destination: "ZTEST_DEST"
                    }]
                })]
            ]);

            const postCommandChain = adapter.createPostCommandChain(new Map<string, string>(), {} as AppVariant, {} as UI5BuilderTools);
            const enhancedFiles = await postCommandChain.execute(files);
            const xsAppJson = JSON.parse(enhancedFiles.get("xs-app.json")!);

            expect(xsAppJson.routes).to.deep.equal([{
                source: "^/sap/opu/odata/sap/ZTEST_SRV/",
                target: "/sap/opu/odata/sap/ZTEST_SRV/",
                authenticationType: "basic",
                destination: "OVERRIDE"
            }, {
                source: "^/sap/opu/odata/sap/ZTEST_SRV/",
                target: "/sap/opu/odata/sap/ZTEST_SRV/",
                authenticationType: "none",
                endpoint: "api-endpoint",
                service: "test-service"
            }]);
        });
    });
});
