import * as chai from "chai";
import * as rollup from "rollup";
import * as sinon from "sinon";
import { SinonSandbox } from "sinon";
import TestUtil from "./util/testUtil";
import RollupBuilder from "../rollup/rollupBuilder";
import * as fs from "fs";

const { normalizer } = require("@ui5/project");
const { expect } = chai;

describe("Rollup", () => {
    let sandbox: SinonSandbox;

    beforeEach(() => sandbox = sinon.createSandbox());
    afterEach(() => sandbox.restore());

    it("should rollup if there were no version specfied", async () => await runRollupBuilder(sandbox, "bundle-no-version.js", 1));
    it("should rollup if the version specified is lower", async () => await runRollupBuilder(sandbox, "bundle-old-version.js", 1));
    it("should rollup if the bundle doesn't exist", async () => {
        sandbox.stub(fs, "existsSync").returns(false);
        const ui5yaml = TestUtil.getResource("ui5.yaml");
        sandbox.stub(fs, "readFileSync").returns(ui5yaml);
        await runAndVerify(sandbox, 1);
    });
    it("shouldn't rollup if the version specified is the same", async () => await runRollupBuilder(sandbox, "bundle-same-version.js", 0));
});

async function runRollupBuilder(sandbox: sinon.SinonSandbox, bundleFilename: string, calls: number) {
    sandbox.stub(fs, "existsSync").returns(true);
    const bundleNoVersion = TestUtil.getResource(bundleFilename);
    const ui5yaml = TestUtil.getResource("ui5.yaml");
    sandbox.stub(fs, "readFileSync")
        .onFirstCall().returns(bundleNoVersion)
        .onSecondCall().returns(ui5yaml);
    await runAndVerify(sandbox, calls);
}

async function runAndVerify(sandbox: sinon.SinonSandbox, calls: number) {
    sandbox.stub(normalizer, "generateProjectTree").returns({});
    const rollupStub = sandbox.stub(rollup, "rollup");
    //@ts-ignore
    const rollupBundle = <rollup.RollupBuild>{
        write: () => { },
        close: () => { },
    };
    rollupStub.callsFake(() => Promise.resolve(rollupBundle));
    await RollupBuilder.run();
    expect(rollupStub.getCalls().length).to.equal(calls);
}
