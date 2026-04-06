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

    async function generateAdpStructure(nodes: AppChainNode[]): Promise<void> {
        for (const node of nodes) {
            const appDir = path.join(adpDir, node.id);
            await fs.mkdir(appDir, { recursive: true });
            if (node.reference) {
                const descriptor = {
                    id: node.id,
                    reference: node.reference
                };
                await fs.writeFile(path.join(appDir, "manifest.appdescr_variant"), JSON.stringify(descriptor));
            } else {
                await fs.writeFile(path.join(appDir, "manifest.json"), JSON.stringify({ "sap.app": { id: node.id } }));
            }
        }
    }

    async function setup() {
        await generateAdpStructure([
            { id: "appId1", reference: "appId2" },
            { id: "appId2", reference: "appId3" },
            { id: "appId3" }
        ]);
        return new LocalRepository({
            appName: "testApp",
            adpDir: "test/tmp/target/.adp"
        });
    }

    describe("getAppVariantIdHierarchy", () => {
        it("returns the complete hierarchy from dynamically generated files", async () => {
            const localRepository = await setup();
            const hierarchy = await localRepository.getAppVariantIdHierarchy("appId1");
            expect(hierarchy).to.deep.equal([
                { repoName: "appId1", appVariantId: "appId1", cachebusterToken: path.join(adpDir, "appId1") },
                { repoName: "appId2", appVariantId: "appId2", cachebusterToken: path.join(adpDir, "appId2") },
                { repoName: "appId3", appVariantId: "appId3", cachebusterToken: path.join(adpDir, "appId3") }
            ]);
        });

        it("throws when referenced app files do not exist", async () => {
            await generateAdpStructure([
                { id: "appId1", reference: "missingApp" }
            ]);
            const localRepository = new LocalRepository({
                appName: "testApp",
                adpDir: "test/tmp/target/.adp"
            });

            await expect(localRepository.getAppVariantIdHierarchy("appId1"))
                .to.be.rejectedWith(Error, "None of the paths exist");
        });
    });

    describe("fetch", () => {
        it("returns files for hierarchy app ids", async () => {
            const localRepository = await setup();
            await fs.mkdir(path.join(adpDir, "appId3", "i18n"), { recursive: true });
            await fs.writeFile(path.join(adpDir, "appId3", "i18n", "i18n.properties"), "hello=world\n");

            const hierarchy = await localRepository.getAppVariantIdHierarchy("appId1");
            const files = await Promise.all(hierarchy.map((item) => localRepository.fetch(item.appVariantId, item.cachebusterToken)));
            expect(JSON.parse(files[0].get("manifest.appdescr_variant")!)).to.deep.equal({ id: "appId1", reference: "appId2" });
            expect(JSON.parse(files[1].get("manifest.appdescr_variant")!)).to.deep.equal({ id: "appId2", reference: "appId3" });
            expect(JSON.parse(files[2].get("manifest.json")!)).to.deep.equal({ "sap.app": { id: "appId3" } });
            expect(files[2].get("i18n/i18n.properties")).to.equal("hello=world\n");
        });
    });

    describe("downloadAnnotationFile", () => {
        it("returns an empty map", async () => {
            const localRepository = new LocalRepository({
                appName: "testApp",
                adpDir: "test/tmp/target/.adp"
            });
            const annotationFiles = await localRepository.downloadAnnotationFile("test/uri");
            expect(annotationFiles.size).to.equal(0);
        });
    });
});
