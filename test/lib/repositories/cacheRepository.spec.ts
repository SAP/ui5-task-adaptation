import * as sinon from "sinon";

import { SinonSandbox } from "sinon";
import { expect } from "chai";
import CacheHolder from "../../../src/cache/cacheHolder.js";
import CacheRepository from "../../../src/repositories/cacheRepository.js";
import IRepository from "../../../src/repositories/repository.js";
import ICachedResource from "../../../src/cache/cachedResource.js";
import { cachedResource, toBufferMap } from "../testUtilities/testUtil.js";

describe("CacheRepository", () => {
    let sandbox: SinonSandbox;
    let delegate: IRepository;
    let repository: CacheRepository;

    const REFERENCE = "com.sap.base.app.id";
    const mergedFiles = () => toBufferMap([["manifest.json", JSON.stringify({ "sap.app": { id: REFERENCE } })]]);

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        CacheHolder.clear();
        delegate = {
            getAppVariantIdHierarchy: sandbox.stub().resolves([{ appName: "repoName1", token: Promise.resolve("token0") }]),
            fetch: sandbox.stub().resolves(toBufferMap([["manifest.json", JSON.stringify({ "sap.app": { id: "delegate" } })]])),
            downloadAnnotationFile: sandbox.stub().resolves("<edmx/>")
        } as unknown as IRepository;
        repository = new CacheRepository(delegate);
    });
    afterEach(() => {
        sandbox.restore();
        CacheHolder.clear();
    });

    describe("getAppVariantIdHierarchy", () => {
        it("returns a single merged resource and skips the delegate on a cache hit", async () => {
            await CacheHolder.write(CacheHolder.mergedResource(REFERENCE), mergedFiles());
            const hierarchy = await repository.getAppVariantIdHierarchy(REFERENCE);
            expect(hierarchy).to.have.lengthOf(1);
            expect(hierarchy[0].appName).to.equal(REFERENCE);
            expect((delegate.getAppVariantIdHierarchy as sinon.SinonStub).called).to.equal(false);
        });

        it("delegates to the wrapped repo when the merged cache is empty", async () => {
            const hierarchy = await repository.getAppVariantIdHierarchy(REFERENCE);
            expect((delegate.getAppVariantIdHierarchy as sinon.SinonStub).calledOnceWith(REFERENCE)).to.equal(true);
            expect(hierarchy.map(item => item.appName)).to.have.members(["repoName1"]);
        });
    });

    describe("fetch", () => {

        it("delegates to the wrapped repo for a resource that is not in the merged cache (e.g. reuse lib)", async () => {
            const resource: ICachedResource = cachedResource("some.reuse.lib", "token0");
            const files = await repository.fetch(resource);
            expect((delegate.fetch as sinon.SinonStub).calledOnceWith(resource)).to.equal(true);
            expect(JSON.parse(files.get("manifest.json")!.toString())["sap.app"].id).to.equal("delegate");
        });

        it("does not use the per-repository cache when fetching the same reference", async () => {
            // A merged fetch must bypass the per-repository cache and use the separate merged tree.
            await CacheHolder.write(cachedResource(REFERENCE, "token0"), toBufferMap([["manifest.json", JSON.stringify({ v: "per-repo" })]]));
            await repository.fetch(cachedResource(REFERENCE));
            expect((delegate.fetch as sinon.SinonStub).called).to.equal(true);
        });
    });

    it("delegates downloadAnnotationFile verbatim", async () => {
        const result = await repository.downloadAnnotationFile("/some/uri");
        expect((delegate.downloadAnnotationFile as sinon.SinonStub).calledOnceWith("/some/uri")).to.equal(true);
        expect(result).to.equal("<edmx/>");
    });
});
