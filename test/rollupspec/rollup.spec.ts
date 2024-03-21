import * as chai from "chai";
import * as sinon from "sinon";

import { SinonSandbox } from "sinon";
import TestUtil from "../testUtilities/testUtil.js";
import chaiAsPromised from "chai-as-promised";
import esmock from "esmock";

const { expect } = chai;
chai.use(chaiAsPromised);

describe("Rollup", () => {
    let sandbox: SinonSandbox;
    const DEFAULT_PROJECT = {
        dependencies: [
            { id: "@openui5/sap.ui.fl", version: "1.95.0" },
            { id: "@openui5/sap.generic.template", version: "1.95.0" }
        ]
    }

    beforeEach(() => sandbox = sinon.createSandbox());
    afterEach(() => sandbox.restore());

    it("should rollup if there were no version specfied", async () => {
        await runRollupBuilder("bundle-no-version.js", 1, DEFAULT_PROJECT);
    });
    it("should rollup if the version specified is lower", async () => {
        await runRollupBuilder("bundle-old-version.js", 1, DEFAULT_PROJECT);
    });
    it("should rollup if the version specified is higher", async () => {
        await runRollupBuilder("bundle-new-version.js", 1, DEFAULT_PROJECT);
    });
    it("should rollup if the bundle doesn't exist", async () => {
        const { RollupBuilder, caller } = await testUi5YamlValidation(false, "ui5.yaml", DEFAULT_PROJECT);
        RollupBuilder.getProjectInfo = () => ({
            getProjects: () => []
        });
        await RollupBuilder.run();
        expect(caller.called).to.equal(1);
    });
    it("should throw error if framework name is incorrect", async () => {
        const { RollupBuilder } = await testUi5YamlValidation(true, "ui5-incorrect-framework.yaml", DEFAULT_PROJECT);
        await expect(RollupBuilder.run()).to.be.rejectedWith("ui5.yaml is not found or incorrect");
    });
    it("should throw error if framework version is incorrect", async () => {
        const { RollupBuilder } = await testUi5YamlValidation(true, "ui5-incorrect-version.yaml", DEFAULT_PROJECT);
        await expect(RollupBuilder.run()).to.be.rejectedWith("ui5.yaml is not found or incorrect");
    });
});

async function testUi5YamlValidation(isFileExist: boolean, testUi5Yaml: string, project: any) {
    let rollupCaller = { called: 0 };
    const rollupBuilder = await esmock("../../scripts/rollup.js", {}, Object.assign({
        "fs": {
            existsSync: () => isFileExist,
            readFileSync: () => TestUtil.getResource(testUi5Yaml)
        }
    }, mockAdditinalDependencies(rollupCaller, project)));
    return {
        RollupBuilder: rollupBuilder,
        caller: rollupCaller
    };
}

async function runRollupBuilder(bundleFilename: string, calls: number, project: any) {
    let fsCall = 0;
    let rollupCaller = { called: 0 };
    const RollupBuilder = await esmock("../../scripts/rollup.js", {}, Object.assign({
        "fs": {
            existsSync: () => true,
            readFileSync: () => TestUtil.getResource(fsCall === 0 ? "ui5.yaml" : bundleFilename)
        }
    }, mockAdditinalDependencies(rollupCaller, project)));

    RollupBuilder.getProjectInfo = () => ({
        getProjects: () => []
    });

    await RollupBuilder.run();
    expect(rollupCaller.called).to.equal(calls);
}

function mockAdditinalDependencies(caller: any, project: any) {
    return {
        "@ui5/project/graph": {
            graphFromPackageDependencies: () => project
        },
        "rollup": {
            rollup: () => {
                caller.called++;
                return Promise.resolve({
                    write: () => { },
                    close: () => { },
                });
            }
        }
    }
}
