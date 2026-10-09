import * as sinon from "sinon";

import AdmZip from "adm-zip";
import CacheHolder from "../../../src/cache/cacheHolder.js";
import HTML5Repository from "../../../src/repositories/html5Repository.js";
import { IProjectOptions } from "../../../src/model/types.js";
import { SinonSandbox } from "sinon";
import TestUtil, { cachedResource, toBuffer, toBufferMap } from "../testUtilities/testUtil.js";
import { expect } from "chai";
import AbapRepository from "../../../src/repositories/abapRepository.js";
import AbapProvider from "../../../src/repositories/abapProvider.js";
import { Ui5AbapRepositoryService } from "@sap-ux/axios-extension";

describe("CacheHolder", () => {
    const options: IProjectOptions = {
        projectNamespace: "ns",
        configuration: {
            destination: "system",
            appName: "appName",
            appHostId: "appHostId",
            appVersion: "1.0.0",
            target: {
                url: "https://example.sap.com"
            }
        }
    };

    let sandbox: SinonSandbox;
    let fetchStub: sinon.SinonStub;

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

    beforeEach(async () => {
        sandbox = sinon.createSandbox();

        await CacheHolder.write(cachedResource("repoName1", "010101"),
            new Map([["manifest.json", toBuffer(JSON.stringify({
                "sap.app": {
                    "id": "com.sap.base.app.id",
                    "applicationVersion": {
                        "version": "1.0.0"
                    }
                }
            }))]]));
        await CacheHolder.write(cachedResource("libName1", "010103"),
            new Map([["manifest.json", toBuffer(JSON.stringify({
                "sap.app": {
                    "id": "com.sap.reuse.lib.id",
                    "applicationVersion": {
                        "version": "1.0.2"
                    }
                }
            }))]])
        );
    });

    afterEach(() => {
        sandbox.restore();
        CacheHolder.clear();
    });

    const assertManifest = (files: Map<string, Buffer>, expectedVersion: string) => {
        const manifestString = files.get("manifest.json")!.toString();
        const manifest = JSON.parse(manifestString);
        expect(manifest["sap.app"].id).to.eql("com.sap.base.app.id");
        expect(manifest["sap.app"].applicationVersion.version).to.eql(expectedVersion);
    };

    const assertReuseLibManifest = (files: Map<string, Buffer>, expectedVersion: string) => {
        const manifestString = files.get("manifest.json")!.toString();
        const manifest = JSON.parse(manifestString);
        expect(manifest["sap.app"].id).to.eql("com.sap.reuse.lib.id");
        expect(manifest["sap.app"].applicationVersion.version).to.eql(expectedVersion);
    };

    describe("Abap Repository", () => {
        let repository: AbapRepository;
        let fetchCalls = 0;
        beforeEach(() => {
            fetchCalls = 0;
            const ui5Repo = {
                get: () => {
                    fetchCalls++;
                    return Promise.resolve({
                        data: JSON.stringify({ d: { ZipArchive: mapToBase64Zip(newManifest) } })
                    });
                }
            } as unknown as Ui5AbapRepositoryService;
            const provider = { getUi5AbapRepository: () => ui5Repo } as unknown as AbapProvider;
            const abapProvider = { get: () => provider };
            repository = new AbapRepository(options.configuration, abapProvider as unknown as AbapProvider);
        });
        it("should get files from cache with same token", async () => {
            assertManifest(await repository.fetch({ appName: "repoName1", token: Promise.resolve("010101") }), "1.0.0");
            assertManifest((await CacheHolder.read(cachedResource("repoName1", "010101")))!, "1.0.0");
            expect(fetchCalls).to.equal(0);
        });

        it("should download files with different token", async () => {
            assertManifest(await repository.fetch({ appName: "repoName1", token: Promise.resolve("010102") }), "1.0.1");
            assertManifest((await CacheHolder.read(cachedResource("repoName1", "010102")))!, "1.0.1");
            expect((await CacheHolder.read(cachedResource("repoName1", "010101"))).size).to.equal(0); // old cache should be deleted
            expect(fetchCalls).to.equal(1);
        });
    });

    describe("HTML5 Repository", () => {
        let repository: HTML5Repository;
        beforeEach(() => {
            repository = new HTML5Repository(options.configuration);
            sandbox.stub(repository, "getHtml5RepoInfo" as any).resolves({});
            fetchStub = sandbox.stub(repository, "getAppZipEntries" as any).callsFake(
                async (...args: unknown[]) => {
                    const appInfo = args[0] as { appName?: string } | undefined;
                    return appInfo?.appName === "libName1"
                        ? newReuseLibManifest
                        : newManifest;
                }
            );
        });
        it("should get files from cache with same token", async () => {
            assertManifest(await repository.fetch({
                appName: "repoName1",
                token: Promise.resolve("010101"),
                appVersion: "1.0.0", appHostId: "libHostId",
            }), "1.0.0");
            assertManifest((await CacheHolder.read(cachedResource("repoName1", "010101")))!, "1.0.0");
            expect(fetchStub.getCalls().length).to.equal(0);
        });

        it("should download files with different token", async () => {
            assertManifest(await repository.fetch({
                appName: "repoName1",
                token: Promise.resolve("010102"),
                appVersion: "1.0.1",
                appHostId: "libHostId",
            }), "1.0.1");
            assertManifest((await CacheHolder.read(cachedResource("repoName1", "010102")))!, "1.0.1");
            expect((await CacheHolder.read(cachedResource("repoName1", "010101"))).size).to.equal(0); // old cache should be deleted
            expect(fetchStub.getCalls().length).to.equal(1);
        });

        it("should get reuse lib files from cache with same token", async () => {
            sandbox.stub(repository as HTML5Repository, "getMetadata").resolves({ applicationName: "libName1", changedOn: "010103" });
            assertReuseLibManifest(await repository.fetch({
                appName: "libName1",
                appVersion: "1.0.2",
                appHostId: "libHostId",
                token: Promise.resolve("010103"),
            }), "1.0.2");
            assertReuseLibManifest(await CacheHolder.read(cachedResource("libName1", "010103")), "1.0.2");
            expect(fetchStub.getCalls().length).to.equal(0);
        });

        it("should download files with different token", async () => {
            sandbox.stub(repository as HTML5Repository, "getMetadata").resolves({ applicationName: "libName1", changedOn: "010104" });
            assertReuseLibManifest(await repository.fetch({
                appName: "libName1",
                appVersion: "1.0.2",
                appHostId: "libHostId",
                token: Promise.resolve("010104"),
            }), "1.0.2");
            assertReuseLibManifest(await CacheHolder.read(cachedResource("libName1", "010104")), "1.0.2");
            expect((await CacheHolder.read(cachedResource("libName1", "010103"))).size).to.equal(0); // old cache should be deleted
            expect(fetchStub.getCalls().length).to.equal(1);
        });
    });

    describe("CacheHolder", () => {
        const manifest = toBufferMap([["manifest.json", "{}"]]);

        before(async () => {
            CacheHolder.clear();
        });

        it("shouldn't clear up to date cache", async () => {
            await CacheHolder.write(cachedResource("repoName1", "010101"), manifest);
            await CacheHolder.write(cachedResource("repoName2", "010101"), manifest);
            await CacheHolder.clearOutdatedExcept("repoName2", 50);
            expect((await CacheHolder.read(cachedResource("repoName1", "010101")))!.size).to.eql(1);
            expect((await CacheHolder.read(cachedResource("repoName2", "010101")))!.size).to.eql(1);
        });
        it("should clear outdated cache except one", async () => {
            await CacheHolder.write(cachedResource("repoName1", "010101"), manifest);
            await CacheHolder.write(cachedResource("repoName2", "010101"), manifest);
            await TestUtil.wait(5);
            await CacheHolder.clearOutdatedExcept("repoName2", 1);
            expect((await CacheHolder.read(cachedResource("repoName1", "010101"))).size).to.equal(0); // old cache should be deleted
        });
        it("should clear outdated cache even with non-existing cache folder", async () => {
            await CacheHolder.clear();
            await CacheHolder.clearOutdatedExcept(undefined, 1);
            expect((await CacheHolder.read(cachedResource("repoName1", "010101"))).size).to.equal(0); // cache shouldn't exist
            expect((await CacheHolder.read(cachedResource("repoName2", "010101"))).size).to.equal(0); // cache shouldn't exist
        });
        it("should clear all outdated cache", async () => {
            await CacheHolder.write(cachedResource("repoName1", "010101"), manifest);
            await CacheHolder.write(cachedResource("repoName2", "010101"), manifest);
            await TestUtil.wait(5);
            await CacheHolder.clearOutdatedExcept(undefined, 1);
            expect((await CacheHolder.read(cachedResource("repoName1", "010101"))).size).to.equal(0); // old cache should be deleted
            expect((await CacheHolder.read(cachedResource("repoName2", "010101"))).size).to.equal(0); // old cache should be deleted
        });
        it("should not cache with undefined token", async () => {
            await CacheHolder.write(cachedResource("undefinedTokenRepo", undefined), manifest);
            expect((await CacheHolder.read(cachedResource("undefinedTokenRepo", "010101"))).size).to.equal(0);
        });
        it("should not cache with undefined appName", async () => {
            await CacheHolder.write(cachedResource(undefined, "010101"), manifest);
            expect((await CacheHolder.read(cachedResource("undefinedAppNameRepo", "010101"))).size).to.equal(0);
        });
        it("should keep other tokens of the same app when keepAppNameDir is set", async () => {
            await CacheHolder.write(cachedResource("keepRepo", "010101"), manifest);
            await CacheHolder.write({ appName: "keepRepo", token: Promise.resolve("010102"), keepAppNameDir: true }, manifest);
            expect((await CacheHolder.read(cachedResource("keepRepo", "010101"))).size).to.equal(1);
            expect((await CacheHolder.read(cachedResource("keepRepo", "010102"))).size).to.equal(1);
        });
    });

    describe("readLatest", () => {
        const files = toBufferMap([["manifest.json", "{}"]]);

        beforeEach(() => {
            CacheHolder.clear();
        });

        it("should read files from the cached repo", async () => {
            await CacheHolder.write(cachedResource("repoName1", "010101"), files);
            const result = await CacheHolder.readLatest("repoName1");
            expect([...result.keys()]).to.have.members(["manifest.json"]);
        });

        it("should throw for repo that was never cached", async () => {
            await expect(CacheHolder.readLatest("unknownRepo")).to.be.rejectedWith("Run a full build first");
        });

        it("should throw for empty repoName", async () => {
            await expect(CacheHolder.readLatest("")).to.be.rejectedWith("Cache read requires 'repoName' to be provided");
        });

        it("should read the current token dir after write() rotated the token", async () => {
            await CacheHolder.write(cachedResource("repoName1", "010101"), toBufferMap([["manifest.json", JSON.stringify({ v: 1 })]]));
            await CacheHolder.write(cachedResource("repoName1", "010102"), toBufferMap([["manifest.json", JSON.stringify({ v: 2 })]]));
            const result = await CacheHolder.readLatest("repoName1");
            expect(JSON.parse(result.get("manifest.json")!.toString())).to.deep.equal({ v: 2 });
        });
    });

});


function mapToBase64Zip(files: Map<string, string>): string {
    const zip = new AdmZip();
    for (const [name, content] of files) {
        zip.addFile(name, Buffer.from(content, "utf8"));
    }
    return zip.toBuffer().toString("base64");
}