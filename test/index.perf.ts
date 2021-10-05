import * as chai from "chai";
import * as chalk from "chalk";
import * as sinon from "sinon";

import HTML5RepoManager from "../src/html5RepoManager";
import { IProjectOptions } from "../src/model/types";
import ResourceUtil from "../src/util/resourceUtil";
import { SinonSandbox } from "sinon";
import TestUtil from "./util/testUtil";

const index = require("../src/index");
const { expect } = chai;
const OPTIONS: IProjectOptions = {
    projectNamespace: "ns",
    configuration: {
        appHostId: "appHostId",
        appId: "appId",
        appName: "appName",
        appVersion: "appVersion",
        spaceGuid: "spaceGuid",
        orgGuid: "orgGuid",
        sapCloudService: "sapCloudService"
    }
};

const ITERATIONS = 1000;
const READ_BASE_APP_FILES = "read base app files from cache";
const results = new Map([
    [READ_BASE_APP_FILES, 0]
]);

describe("Performance test", () => {
    let sandbox: SinonSandbox = sinon.createSandbox();
    let html5RepoManagerStub = sandbox.stub(HTML5RepoManager, "getBaseAppFiles");

    const run = async (routine: any) => {
        const { workspace, taskUtil } = await TestUtil.getWorkspace("appVariant1");
        const workspaceSpied = sinon.spy(workspace, "write");

        // Routine to test performance
        await routine(workspace, taskUtil);

        expect(html5RepoManagerStub.getCalls().length).to.equal(0);
        const resourcePaths = workspaceSpied.getCalls().map(call => call.args[0].getPath());
        expect(resourcePaths).to.have.members([
            "/customer_com_sap_application_variant_id/i18n/i18n.properties",
            "/manifest.appdescr_variant",
            "/resources/ns/manifest.json",
            "/resources/ns/component-preload.js"
        ]);
        const tempResources = await ResourceUtil.readTemp(OPTIONS.configuration);
        expect([...tempResources.keys()]).to.have.members([
            "/manifest.json",
            "/component-preload.js"
        ]);

        sandbox.restore();
    }

    before(async () => {
        const baseAppFiles = new Map([
            ["manifest.json", TestUtil.getResource("manifest.json")],
            ["component-preload.js", TestUtil.getResource("component-preload.js")]
        ]);
        await ResourceUtil.writeTemp(OPTIONS.configuration, baseAppFiles);
        sandbox.stub(HTML5RepoManager, "getMetadata").callsFake(() => Promise.resolve({ changedOn: "2100.01.01" }));
        html5RepoManagerStub.callsFake(() => Promise.resolve(baseAppFiles));
    });

    after(async () => {
        await ResourceUtil.deleteTemp(OPTIONS.configuration);
    });

    it("should read base app files from cache and adapt", async () => {
        let total = 0;
        for (let i = 0; i < ITERATIONS; i++) {
            await run(async (workspace: any, taskUtil: any) => {
                const start = new Date().getTime();
                await index({ workspace, options: OPTIONS, taskUtil });
                const end = new Date().getTime();
                total += end - start;
            });
        }
        results.set(READ_BASE_APP_FILES, total / ITERATIONS);
    });

    after(() => {
        console.log("\n  Results per single run");
        results.forEach((value: number, key: string) => {
            console.log(`    ${chalk.green("~")} ${chalk.gray(key)} ${chalk.green(value + "ms")}`)
        });
    });

});