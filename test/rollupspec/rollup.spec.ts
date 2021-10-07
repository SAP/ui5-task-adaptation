import * as chai from "chai";
import * as rollup from "rollup";
import * as sinon from "sinon";
import { SinonSandbox } from "sinon";
import TestUtil from "../util/testUtil";
import RollupBuilder from "../../scripts/rollup";
import * as fs from "fs";
import * as chaiAsPromised from "chai-as-promised";

const { normalizer } = require("@ui5/project");
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
        await runRollupBuilder(sandbox, "bundle-no-version.js", 1, DEFAULT_PROJECT);
    });
    it("should rollup if the version specified is lower", async () => {
        await runRollupBuilder(sandbox, "bundle-old-version.js", 1, DEFAULT_PROJECT);
    });
    it("should rollup if the bundle doesn't exist", async () => {
        sandbox.stub(fs, "existsSync").returns(false);
        const ui5yaml = TestUtil.getResource("ui5.yaml");
        sandbox.stub(fs, "readFileSync").returns(ui5yaml);
        const rollupStub = await prepareStubs(sandbox, DEFAULT_PROJECT);
        await RollupBuilder.run("./dist/bundle.js");
        expect(rollupStub.getCalls().length).to.equal(1);
    });
    it("shouldn't rollup if the version specified is the same", async () => {
        await runRollupBuilder(sandbox, "bundle-same-version.js", 0, {
            dependencies: [
                { id: "@openui5/sap.ui.fl", version: "1.91.0" },
                { id: "@openui5/sap.generic.template", version: "1.91.0" }
            ]
        });
    });
    it("shouldn't rollup if no sap.ui.fl dependencies found", async () => {
        await runRollupBuilder(sandbox, "bundle-same-version.js", 0, {
            dependencies: [
                { id: "@openui5/sap.generic.template", version: "1.91.0" }
            ]
        });
    });
    it("should throw error if framework name is incorrect", async () => {
        await testUi5YamlValidation(sandbox, "ui5-incorrect-framework.yaml", DEFAULT_PROJECT);
        await expect(RollupBuilder.run("./dist/bundle.js")).to.be.rejectedWith("ui5.yaml is not found or incorrect")
    });
    it("should throw error if framework name is incorrect", async () => {
        await testUi5YamlValidation(sandbox, "ui5-incorrect-version.yaml", DEFAULT_PROJECT);
        await expect(RollupBuilder.run("./dist/bundle.js")).to.be.rejectedWith("ui5.yaml is not found or incorrect")
    });
});

async function testUi5YamlValidation(sandbox: sinon.SinonSandbox, testUi5Yaml: string, project: any) {
    sandbox.stub(fs, "existsSync").returns(true);
    const ui5yaml = TestUtil.getResource(testUi5Yaml);
    sandbox.stub(fs, "readFileSync").returns(ui5yaml);
    const rollupStub = await prepareStubs(sandbox, project);
    expect(rollupStub.getCalls().length).to.equal(0);
}

async function runRollupBuilder(sandbox: sinon.SinonSandbox, bundleFilename: string, calls: number, project: any) {
    sandbox.stub(fs, "existsSync").returns(true);
    const bundleNoVersion = TestUtil.getResource(bundleFilename);
    const ui5yaml = TestUtil.getResource("ui5.yaml");
    sandbox.stub(fs, "readFileSync")
        .onFirstCall().returns(bundleNoVersion)
        .onSecondCall().returns(ui5yaml);

    const rollupStub = await prepareStubs(sandbox, project);
    await RollupBuilder.run("./dist/bundle.js");
    expect(rollupStub.getCalls().length).to.equal(calls);
}

async function prepareStubs(sandbox: sinon.SinonSandbox, project: any) {
    sandbox.stub(normalizer, "generateProjectTree").returns(project);
    const rollupStub = sandbox.stub(rollup, "rollup");
    //@ts-ignore
    const rollupBundle = <rollup.RollupBuild>{
        write: () => { },
        close: () => { },
    };
    rollupStub.callsFake(() => Promise.resolve(rollupBundle));
    return rollupStub;
}
