import ResourceUtil from "../../../../src/util/resourceUtil.js";
import { assert, expect } from "chai";
import * as sinon from "sinon";
import { SinonSandbox } from "sinon";
import FsUtil from "../../../../src/util/fsUtil.js";
import FetchPreviewResourcesCommand from "../../../../src/adapters/commands/fetchPreviewResourcesCommand.js";
import ProcessPreviewResourcesCommand from "../../../../src/adapters/commands/processPreviewResourcesCommand.js";
import esmock from "esmock";
import { ServiceCredentials } from "../../../../src/model/types.js";
import CFUtil from "../../../../src/util/cfUtil.js";
import { dependsOn } from "../../../../src/adapters/adapter.js";


describe("FetchPreviewResourcesCommand", () => {
    let sandbox: SinonSandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
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

        const repositoryStub = {
            fetch: async (_: string) => []
        } as any;

        sandbox.stub(FsUtil, "readInProject").returns(Promise.resolve(appInfo));

        const command = new FetchPreviewResourcesCommand("reuse.lib1", repositoryStub);
        await command.execute();
        const previewPromise = await dependsOn(command);
        expect(previewPromise!.size > 0).to.be.true;
    });

    it("should raise an error if ui5AppInfo.json is missing", async () => {
        const files = new Map<string, string>();
        sandbox.stub(ResourceUtil, "byGlobInProject").returns(Promise.resolve(files));

        const command = new FetchPreviewResourcesCommand("reuse.lib1", {} as any);
        try {
            await command.execute();
            await command.result;
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
        const repositoryStub = {
            fetch: async () => new Map<string, string>()
        } as any;
        sandbox.stub(FsUtil, "readInProject").returns(Promise.resolve(appInfoContent));

        const command = new FetchPreviewResourcesCommand("reuse.lib1", repositoryStub);
        await command.execute();
        const previewPromise = await dependsOn(command);
        expect(await previewPromise!.size > 0).to.be.false;
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

        const repository = {
            fetch: async () => {
                const libFiles = new Map<string, string>();
                libFiles.set("file1.js", "console.log('file1');");
                libFiles.set("file2.js", "console.log('file2');");
                return libFiles;
            }
        } as any;

        sandbox.stub(FsUtil, "readInProject").returns(Promise.resolve(appInfoContent));

        const command = new FetchPreviewResourcesCommand("reuse.lib1", repository);
        await command.execute();
        await command.result;
        const processCommand = new ProcessPreviewResourcesCommand(Promise.resolve({} as unknown as ServiceCredentials), command.result);
        await processCommand.execute(new Map<string, string>([["xs-app.json", "{}"]]));

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

        const ProcessPreviewResourcesCommandClass = await esmock(
            "../../../../src/adapters/commands/processPreviewResourcesCommand.js",
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
        ) as typeof ProcessPreviewResourcesCommand;

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

        const repositoryStub = {
            fetch: async () => new Map<string, string>()
        } as any;

        sandbox.stub(FsUtil, "readInProject").returns(Promise.resolve(appInfoContent));

        const command = new FetchPreviewResourcesCommand("reuse.libEmpty", repositoryStub);
        await command.execute();
        const processCommand = new ProcessPreviewResourcesCommandClass(Promise.resolve({} as unknown as ServiceCredentials), command.result);
        await processCommand.execute(new Map<string, string>([["xs-app.json", "{}"]]));

        expect(warnSpy.called).to.be.true;
        expect(warnSpy.calledWithMatch(/No files found in reuse library libEmpty for preview/)).to.be.true;
        expect(writeStub.called).to.be.true;
    });
});
