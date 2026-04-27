import * as fs from "node:fs/promises";
import path from "node:path";
import { expect } from "chai";
import LocalRepository from "../../../src/repositories/localRepository.js";

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
                .to.be.rejectedWith(Error, "None of the paths exist");
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
});
