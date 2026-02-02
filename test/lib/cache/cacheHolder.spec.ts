import * as sinon from "sinon";

import AbapProcessor from "../../../src/processors/abapProcessor.js";
import AbapProvider from "../../../src/repositories/abapProvider.js";
import AbapRepoManager from "../../../src/repositories/abapRepoManager.js";
import AnnotationManager from "../../../src/annotationManager.js";
import CFProcessor from "../../../src/processors/cfProcessor.js";
import CacheHolder from "../../../src/cache/cacheHolder.js";
import HTML5RepoManager from "../../../src/repositories/html5RepoManager.js";
import { IProjectOptions } from "../../../src/model/types.js";
import { SinonSandbox } from "sinon";
import TestUtil from "../testUtilities/testUtil.js";
import esmock from "esmock";
import { expect } from "chai";

describe("CacheHolder", () => {
    const options: IProjectOptions = {
        projectNamespace: "ns",
        configuration: {
            destination: "system",
            appName: "appName",
            target: {
                url: "https://example.sap.com"
            }
        }
    };

    let sandbox: SinonSandbox;
    let fetchStub: sinon.SinonStub;
    let getBaseAppFilesStub: sinon.SinonStub;
    let getReuseLibFilesStub: sinon.SinonStub;
    const abapProvider = new AbapProvider();
    const abapRepoManager = new AbapRepoManager(options.configuration, abapProvider);
    const annotationManager = new AnnotationManager(options.configuration, abapRepoManager);
    const abapProcessor = new AbapProcessor(options.configuration, abapRepoManager, annotationManager);

    const cfProcessor = new CFProcessor(options.configuration);

    beforeEach(async () => {
        const newManifest =
            new Map([["manifest.json", JSON.stringify({
                "sap.app": {
                    "id": "com.sap.base.app.id",
                    "applicationVersion": {
                        "version": "1.0.1"
                    }
                }
            })]]);
        const newReuseLibManifest =
            new Map([["manifest.json", JSON.stringify({
                "sap.app": {
                    "id": "com.sap.reuse.lib.id",
                    "applicationVersion": {
                        "version": "1.0.2"
                    }
                }
            })]]);
        sandbox = sinon.createSandbox();
        fetchStub = sandbox.stub(abapRepoManager, "fetch").resolves(newManifest);
        getBaseAppFilesStub = sandbox.stub(HTML5RepoManager, "getBaseAppFiles").resolves(newManifest);
        getReuseLibFilesStub = sandbox.stub(HTML5RepoManager, "getReuseLibFiles").resolves(newReuseLibManifest);
        await CacheHolder.write("repoName1", "010101",
            new Map([["manifest.json", JSON.stringify({
                "sap.app": {
                    "id": "com.sap.base.app.id",
                    "applicationVersion": {
                        "version": "1.0.0"
                    }
                }
            })]])
        );
        await CacheHolder.write("libName1", "010103",
            new Map([["manifest.json", JSON.stringify({
                "sap.app": {
                    "id": "com.sap.reuse.lib.id",
                    "applicationVersion": {
                        "version": "1.0.2"
                    }
                }
            })]])
        );
    });

    afterEach(() => {
        sandbox.restore();
        CacheHolder.clear();
    });

    const assertManifest = (files: Map<string, string>, expectedVersion: string) => {
        const manifestString = files.get("manifest.json")!;
        const manifest = JSON.parse(manifestString);
        expect(manifest["sap.app"].id).to.eql("com.sap.base.app.id");
        expect(manifest["sap.app"].applicationVersion.version).to.eql(expectedVersion);
    };

    const assertReuseLibManifest = (files: Map<string, string>, expectedVersion: string) => {
        const manifestString = files.get("manifest.json")!;
        const manifest = JSON.parse(manifestString);
        expect(manifest["sap.app"].id).to.eql("com.sap.reuse.lib.id");
        expect(manifest["sap.app"].applicationVersion.version).to.eql(expectedVersion);
    };

    describe("Abap Processor", () => {
        it("should get files from cache with same chacheBusterToken", async () => {
            assertManifest(await abapProcessor.fetch("repoName1", "010101"), "1.0.0");
            assertManifest((await CacheHolder.read("repoName1", "010101"))!, "1.0.0");
            expect(fetchStub.getCalls().length).to.equal(0);
        });

        it("should download files with different chacheBusterToken", async () => {
            assertManifest(await abapProcessor.fetch("repoName1", "010102"), "1.0.1");
            assertManifest((await CacheHolder.read("repoName1", "010102"))!, "1.0.1");
            expect((await CacheHolder.read("repoName1", "010101")).size).to.equal(0); // old cache should be deleted
            expect(fetchStub.getCalls().length).to.equal(1);
        });
    });

    describe("CF Processor", () => {
        it("should get files from cache with same chacheBusterToken", async () => {
            sandbox.stub(HTML5RepoManager, "getMetadata").resolves({ applicationName: "repoName1", changedOn: "010101" });
            assertManifest(await cfProcessor.fetch("repoName1", "010101"), "1.0.0");
            assertManifest((await CacheHolder.read("repoName1", "010101"))!, "1.0.0");
            expect(fetchStub.getCalls().length).to.equal(0);
        });

        it("should download files with different chacheBusterToken", async () => {
            sandbox.stub(HTML5RepoManager, "getMetadata").resolves({ applicationName: "repoName1", changedOn: "010102" });
            assertManifest(await cfProcessor.fetch("repoName1", "010102"), "1.0.1");
            assertManifest((await CacheHolder.read("repoName1", "010102"))!, "1.0.1");
            expect((await CacheHolder.read("repoName1", "010101")).size).to.equal(0); // old cache should be deleted
            expect(getBaseAppFilesStub.getCalls().length).to.equal(1);
        });

        it("should get reuse lib files from cache with same chacheBusterToken", async () => {
            sandbox.stub(HTML5RepoManager, "getMetadata").resolves({ applicationName: "libName1", changedOn: "010103" });
            assertReuseLibManifest(await cfProcessor.fetchReuseLib("libName1", "010103", {} as any), "1.0.2");
            assertReuseLibManifest(await CacheHolder.read("libName1", "010103"), "1.0.2");
            expect(fetchStub.getCalls().length).to.equal(0);
        });

        it("should download files with different chacheBusterToken", async () => {
            sandbox.stub(HTML5RepoManager, "getMetadata").resolves({ applicationName: "libName1", changedOn: "010104" });
            assertReuseLibManifest(await cfProcessor.fetchReuseLib("libName1", "010104", {} as any), "1.0.2");
            assertReuseLibManifest(await CacheHolder.read("libName1", "010104"), "1.0.2");
            expect((await CacheHolder.read("libName1", "010103")).size).to.equal(0); // old cache should be deleted
            expect(getReuseLibFilesStub.getCalls().length).to.equal(1);
        });
    });

    describe("CacheHolder", () => {
        const manifest = new Map([["manifest.json", "{}"]]);
        let log = { message: "" }, CacheHolderMock: typeof CacheHolder;

        before(async () => CacheHolderMock = await getCacheHolderMock(log));
        it("shouldn't clear up to date cache", async () => {
            await CacheHolder.write("repoName1", "010101", manifest);
            await CacheHolder.write("repoName2", "010101", manifest);
            await CacheHolder.clearOutdatedExcept("repoName2", 50);
            expect((await CacheHolder.read("repoName1", "010101"))!.size).to.eql(1);
            expect((await CacheHolder.read("repoName2", "010101"))!.size).to.eql(1);
        });
        it("should clear outdated cache except one", async () => {
            await CacheHolder.write("repoName1", "010101", manifest);
            await CacheHolder.write("repoName2", "010101", manifest);
            await TestUtil.wait(5);
            await CacheHolder.clearOutdatedExcept("repoName2", 1);
            expect((await CacheHolder.read("repoName1", "010101")).size).to.equal(0); // old cache should be deleted
        });
        it("should clear outdated cache even with non-existing cache folder", async () => {
            await CacheHolder.clear();
            await CacheHolder.clearOutdatedExcept(undefined, 1);
            expect((await CacheHolder.read("repoName1", "010101")).size).to.equal(0); // cache shouldn't exist
            expect((await CacheHolder.read("repoName2", "010101")).size).to.equal(0); // cache shouldn't exist
        });
        it("should clear all outdated cache", async () => {
            await CacheHolder.write("repoName1", "010101", manifest);
            await CacheHolder.write("repoName2", "010101", manifest);
            await TestUtil.wait(5);
            await CacheHolder.clearOutdatedExcept(undefined, 1);
            expect((await CacheHolder.read("repoName1", "010101")).size).to.equal(0); // old cache should be deleted
            expect((await CacheHolder.read("repoName2", "010101")).size).to.equal(0); // old cache should be deleted
        });
        it("should not cache with empty token", async () => {
            await CacheHolderMock.write("repoName1", "", manifest);
            expect((await CacheHolderMock.read("repoName1", "")).size).to.equal(0);
            expect(log.message).eql("No 'token' provided, skipping cache write");
        });
        it("should not cache with empty repoName", async () => {
            await CacheHolderMock.write("", "010101", manifest);
            expect((await CacheHolderMock.read("", "010101")).size).to.equal(0);
            expect(log.message).eql("No 'repoName' provided, skipping cache write");
        });
    });

});


function getCacheHolderMock(log: any) {
    return esmock("../../../src/cache/cacheHolder.js", {}, {
        "@ui5/logger": {
            getLogger: () => {
                return {
                    warn: (message: string) => {
                        log.message = message;
                    },
                    silly: () => { }
                };
            }
        }
    });
}
