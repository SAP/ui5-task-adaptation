import { IProjectOptions } from "../../src/model/types.js";
import ResourceUtil from "../../src/util/resourceUtil.js";
import TestUtil from "./testUtilities/testUtil.js";
import esmock from "esmock";
import { expect } from "chai";

const options: IProjectOptions = {
    projectNamespace: "ns",
    configuration: {
        appHostId: "appHostId",
        appId: "appId",
        appName: "appName",
        appVersion: "appVersion",
        space: "spaceGuid",
        org: "orgGuid",
        sapCloudService: "sapCloudService"
    }
};

const ITERATIONS = 100;
const ADAPT_BASE_APP_FILES = "Adapt base app files";
const results = new Map([
    [ADAPT_BASE_APP_FILES, 0]
]);

describe("Performance test", () => {

    it("should adapt base app files", async () => {
        const baseAppFiles = new Map([
            ["manifest.json", JSON.stringify({
                "sap.app": {
                    "id": "com.sap.base.app.id",
                    "i18n": "i18n/i18n.properties",
                    "applicationVersion": {
                        "version": "1.0.0"
                    }
                }
            })],
            ["i18n/i18n.properties", "baseApp"],
            ["i18n/i18n_de.properties", "baseApp de"],
            ["component-preload.js", TestUtil.getResource("component-preload.js")]]);
        const CFProcessor = await esmock("../../src/processors/cfProcessor.js");
        const index = await esmock("../../src/index.js", {}, {
            "../../src/processors/processor.js": {
                determineProcessor: () => new CFProcessor({}, { getFiles: () => Promise.resolve(baseAppFiles) })
            }
        });
        const { workspace, taskUtil } = await TestUtil.getWorkspace("integration/appVar1", options.projectNamespace);
        let total = 0;
        for (let i = 0; i < ITERATIONS; i++) {
            const start = new Date().getTime();
            await index({ workspace, options, taskUtil });
            const end = new Date().getTime();
            total += end - start;
        }
        const resources = (await workspace.byGlob("/**/*")).filter(TestUtil.byIsOmited(taskUtil));
        const files = await ResourceUtil.toFileMap(resources, options.projectNamespace);
        expect([...files.keys()]).to.have.members([
            "manifest.json",
            "i18n/i18n.properties",
            "i18n/i18n_de.properties",
            "component-preload.js"
        ]);
        const manifest = JSON.parse(files.get("manifest.json")!);
        expect(manifest["sap.app"].id).to.eql("customer.com.sap.application.variant.id");
        expect(files.get("i18n/i18n.properties")?.split("\n")).to.include.members(["baseApp", "appVariant"]);
        expect(files.get("i18n/i18n_de.properties")?.split("\n")).to.include.members(["baseApp de", "appVariant de"]);
        results.set(ADAPT_BASE_APP_FILES, total / ITERATIONS);
    });

    after(() => {
        console.log("\nResults per single run");
        results.forEach((value: number, key: string) => console.log(`- ${key}: ${value + "ms"}`));
    });

});