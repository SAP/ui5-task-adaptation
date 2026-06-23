import * as chai from "chai";
import * as fs from "node:fs/promises";
import path from "node:path";
import chaiAsPromised from "chai-as-promised";
import LocalRepository from "../../../src/repositories/localRepository.js";

chai.use(chaiAsPromised);
const { expect } = chai;

type AppChainNode = {
    id: string;
    reference?: string;
};

describe("LocalRepository", () => {
    const tmpRoot = path.join(process.cwd(), "test", "tmp");
    const adpDir = path.join(tmpRoot, "target", ".adp");

    beforeEach(async () => {
        await fs.rm(tmpRoot, { recursive: true, force: true });
    });

    afterEach(() => delete process.env.ADP_BUILDER_DIR);

    async function generateAdpStructure(nodes: AppChainNode[], isArtefact = false): Promise<void> {
        for (const node of nodes) {
            const appBaseId = node.id + (isArtefact ? "-opt-static-abap" : "");
            const appDir = path.join(adpDir, appBaseId);
            const fileDir = isArtefact ? appDir : path.join(appDir, "webapp");
            await fs.mkdir(fileDir, { recursive: true });
            if (node.reference) {
                const descriptor = { id: node.id, reference: node.reference };
                await fs.writeFile(path.join(fileDir, "manifest.appdescr_variant"), JSON.stringify(descriptor));
            } else {
                await fs.writeFile(path.join(fileDir, "manifest.json"), JSON.stringify({ "sap.app": { id: node.id } }));
            }
        }
    }

    async function setup(isArtefact = false) {
        await generateAdpStructure([
            { id: "appId1", reference: "appId2" },
            { id: "appId2", reference: "appId3" },
            { id: "appId3" }
        ], isArtefact);
        process.env.ADP_BUILDER_DIR = "test/tmp/target/.adp";
        return new LocalRepository();
    }

    async function setupManualVariant(appId: string, descriptor: Record<string, unknown>): Promise<void> {
        const appDir = path.join(adpDir, appId, "webapp");
        await fs.mkdir(appDir, { recursive: true });
        await fs.writeFile(path.join(appDir, "manifest.appdescr_variant"), JSON.stringify(descriptor));
        process.env.ADP_BUILDER_DIR = "test/tmp/target/.adp";
    }

    async function expectInvalidReference(appId: string, descriptor: Record<string, unknown>): Promise<void> {
        await setupManualVariant(appId, descriptor);
        await expect(new LocalRepository().getAppVariantIdHierarchy(appId))
            .to.be.rejectedWith(Error, "Invalid or missing 'reference'");
    }

    describe("getAppVariantIdHierarchy", () => {
        it("returns the complete hierarchy from dynamically generated files", async () => {
            const localRepository = await setup();
            const hierarchy = await localRepository.getAppVariantIdHierarchy("appId1");
            const actual = await Promise.all(hierarchy.map(async (item) => ({ ...item, cacheBusterToken: await item.cacheBusterToken })));
            expect(actual).to.deep.equal([
                { appName: "appId1", absolutePath: path.join(adpDir, "appId1", "webapp"), cacheBusterToken: "local" },
                { appName: "appId2", absolutePath: path.join(adpDir, "appId2", "webapp"), cacheBusterToken: "local" },
                { appName: "appId3", absolutePath: path.join(adpDir, "appId3", "webapp"), cacheBusterToken: "local" }
            ]);
        });

        it("returns the complete hierarchy from dynamically generated files with classifier", async () => {
            const localRepository = await setup(true);
            const hierarchy = await localRepository.getAppVariantIdHierarchy("appId1");
            const actual = await Promise.all(hierarchy.map(async (item) => ({ ...item, cacheBusterToken: await item.cacheBusterToken })));
            expect(actual).to.deep.equal([
                { appName: "appId1", absolutePath: path.join(adpDir, "appId1-opt-static-abap"), cacheBusterToken: "local" },
                { appName: "appId2", absolutePath: path.join(adpDir, "appId2-opt-static-abap"), cacheBusterToken: "local" },
                { appName: "appId3", absolutePath: path.join(adpDir, "appId3-opt-static-abap"), cacheBusterToken: "local" }
            ]);
        });

        it("throws when referenced app files do not exist", async () => {
            await generateAdpStructure([
                { id: "appId1", reference: "missingApp" }
            ]);
            process.env.ADP_BUILDER_DIR = "test/tmp/target/.adp";
            await expect(new LocalRepository().getAppVariantIdHierarchy("appId1"))
                .to.be.rejectedWith(Error, "App 'missingApp' not found");
        });

        it("throws when a self-referencing cycle is detected", async () => {
            await generateAdpStructure([
                { id: "appId1", reference: "appId1" }
            ]);
            process.env.ADP_BUILDER_DIR = "test/tmp/target/.adp";
            await expect(new LocalRepository().getAppVariantIdHierarchy("appId1"))
                .to.be.rejectedWith(Error, "Cycle detected in app variant hierarchy: 'appId1' was already visited");
        });

        it("throws when a multi-node cycle is detected", async () => {
            await generateAdpStructure([
                { id: "appId1", reference: "appId2" },
                { id: "appId2", reference: "appId3" },
                { id: "appId3", reference: "appId1" }
            ]);
            process.env.ADP_BUILDER_DIR = "test/tmp/target/.adp";
            await expect(new LocalRepository().getAppVariantIdHierarchy("appId1"))
                .to.be.rejectedWith(Error, "Cycle detected in app variant hierarchy: 'appId1' was already visited");
        });

        it("throws when manifest.appdescr_variant has no reference", async () => {
            await expectInvalidReference("appId1", { id: "appId1" });
        });

        it("throws when manifest.appdescr_variant reference is not a string", async () => {
            await expectInvalidReference("appId1", { id: "appId1", reference: 123 });
        });

        it("throws when manifest.appdescr_variant reference is an empty string", async () => {
            await expectInvalidReference("appId1", { id: "appId1", reference: "" });
        });

        it("returns a single item for a base app without references", async () => {
            await generateAdpStructure([
                { id: "appId1" }
            ]);
            process.env.ADP_BUILDER_DIR = "test/tmp/target/.adp";
            const hierarchy = await new LocalRepository().getAppVariantIdHierarchy("appId1");
            expect(hierarchy).to.have.lengthOf(1);
            expect(hierarchy[0].appName).to.equal("appId1");
            expect(hierarchy[0].absolutePath).to.equal(path.join(adpDir, "appId1", "webapp"));
        });

        it("includes visited IDs in cycle error message", async () => {
            await generateAdpStructure([
                { id: "appId1", reference: "appId2" },
                { id: "appId2", reference: "appId1" }
            ]);
            process.env.ADP_BUILDER_DIR = "test/tmp/target/.adp";
            await expect(new LocalRepository().getAppVariantIdHierarchy("appId1"))
                .to.be.rejectedWith(Error, "appId1 -> appId2 -> appId1");
        });
    });

    describe("fetch", () => {
        it("returns files for hierarchy app ids", async () => {
            const localRepository = await setup();
            await fs.mkdir(path.join(adpDir, "appId3", "webapp", "i18n"), { recursive: true });
            await fs.writeFile(path.join(adpDir, "appId3", "webapp", "i18n", "i18n.properties"), "hello=world\n");

            const hierarchy = await localRepository.getAppVariantIdHierarchy("appId1");
            const files = await Promise.all(hierarchy.map((item) => localRepository.fetch(item)));
            expect(JSON.parse(files[0].get("manifest.appdescr_variant")!)).to.deep.equal({ id: "appId1", reference: "appId2" });
            expect(JSON.parse(files[1].get("manifest.appdescr_variant")!)).to.deep.equal({ id: "appId2", reference: "appId3" });
            expect(JSON.parse(files[2].get("manifest.json")!)).to.deep.equal({ "sap.app": { id: "appId3" } });
            expect(files[2].get("i18n/i18n.properties")).to.equal("hello=world\n");
        });
    });

    describe("downloadAnnotationFile", () => {
        it("returns an empty map", async () => {
            const localRepository = new LocalRepository();
            const annotationFiles = await localRepository.downloadAnnotationFile("test/uri");
            expect(annotationFiles.size).to.equal(0);
        });
    });

    describe("getLocalFilesDir", () => {
        it("throws when ADP_BUILDER_DIR is not set", async () => {
            await expect(new LocalRepository().getAppVariantIdHierarchy("any"))
                .to.be.rejectedWith("Environment variable 'ADP_BUILDER_DIR' is not set");
        });

        it("accepts Linux absolute path", async () => {
            const absDir = path.resolve("test/tmp/target/.adp");
            process.env.ADP_BUILDER_DIR = absDir;
            await generateAdpStructure([{ id: "appId1" }]);
            const hierarchy = await new LocalRepository().getAppVariantIdHierarchy("appId1");
            expect(hierarchy[0].absolutePath).to.equal(path.join(absDir, "appId1", "webapp"));
        });

        it("resolves relative path against cwd", async () => {
            process.env.ADP_BUILDER_DIR = "test/tmp/target/.adp";
            await generateAdpStructure([{ id: "appId1" }]);
            const hierarchy = await new LocalRepository().getAppVariantIdHierarchy("appId1");
            expect(hierarchy[0].absolutePath).to.equal(path.join(process.cwd(), "test/tmp/target/.adp", "appId1", "webapp"));
        });

        it("strips trailing slash from relative path", async () => {
            process.env.ADP_BUILDER_DIR = "test/tmp/target/.adp/";
            await generateAdpStructure([{ id: "appId1" }]);
            const hierarchy = await new LocalRepository().getAppVariantIdHierarchy("appId1");
            expect(hierarchy[0].absolutePath).to.equal(path.join(process.cwd(), "test/tmp/target/.adp", "appId1", "webapp"));
        });

        it("handles backslash-separated relative path (Windows-style)", async () => {
            process.env.ADP_BUILDER_DIR = "test\\tmp\\target\\.adp";
            await generateAdpStructure([{ id: "appId1" }]);
            const hierarchy = await new LocalRepository().getAppVariantIdHierarchy("appId1");
            expect(hierarchy[0].absolutePath).to.equal(path.join(process.cwd(), "test/tmp/target/.adp", "appId1", "webapp"));
        });

        it("handles backslash-separated relative path with trailing backslash", async () => {
            process.env.ADP_BUILDER_DIR = "test\\tmp\\target\\.adp\\";
            await generateAdpStructure([{ id: "appId1" }]);
            const hierarchy = await new LocalRepository().getAppVariantIdHierarchy("appId1");
            expect(hierarchy[0].absolutePath).to.equal(path.join(process.cwd(), "test/tmp/target/.adp", "appId1", "webapp"));
        });
    });
});
