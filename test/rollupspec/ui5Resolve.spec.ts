import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import * as sinon from "sinon";
import * as util from "util";

import { SinonSandbox } from "sinon";
import TestUtil from "../util/testUtil";
import ui5Resolve from "../../scripts/rollup/ui5Resolve";

const { resourceFactory } = require("@ui5/fs");

const { expect } = chai;
chai.use(chaiAsPromised);

describe("UI5Resolve", () => {
    let sandbox: SinonSandbox;

    beforeEach(() => sandbox = sinon.createSandbox());
    afterEach(() => sandbox.restore());

    describe("when transform", () => {
        it("should skip the module with given id", async () => {
            expect(ui5Resolve({
                skipTransformation: [
                    "id-should-be-skipped"
                ]
            }).transform("code", "id-should-be-skipped")).to.be.undefined;
        });

        it("should replace requireAsync.bind", async () => {
            //@ts-ignore
            sandbox.stub(crypto, "randomBytes").returns(Buffer.from(""));
            expect(ui5Resolve({}).transform(TestUtil.getResource("registration-bind.js"), "id")).
                to.eql(TestUtil.getResource("registration-bind-expected.js"));
        });

        it("should replace requireAsync", async () => {
            //@ts-ignore
            sandbox.stub(crypto, "randomBytes").returns(Buffer.from(""));
            expect(ui5Resolve({}).transform(TestUtil.getResource("registration.js"), "id")).
                to.eql(TestUtil.getResource("registration-expected.js"));
        });
    });

    describe("when buildStart", () => {
        it("should stream the resource", async () => {
            const createWriteStreamStub = sandbox.stub(fs, "createWriteStream");
            sandbox.stub(resourceFactory, "createCollectionsForTree").returns({
                dependencies: {
                    byGlob: () => Promise.resolve(
                        resourceFactory.createResource({
                            path: "/path",
                            string: TestUtil.getResource("registration-expected.js")
                        })
                    )
                }
            });
            const pipeStub = sandbox.stub(util, "promisify").returns(() => undefined);
            await ui5Resolve({
                assets: [
                    "/resources/sap/ui/fl/**"
                ]
            }).buildStart({});
            expect(pipeStub.getCalls().length).to.equal(1);
            expect(createWriteStreamStub.getCalls()[0].args[0]).to.equal("./dist/path");
        });
    });

    describe("when renderChunk", () => {
        it("should add version and window", async () => {
            expect(ui5Resolve({ ui5version: "1.0.0" }).renderChunk("code")).to.eql("//1.0.0\nvar window = {};\ncode");
        });
    });

    describe("when resolveId", () => {
        it("should resolve relative path", async () => {
            expect(ui5Resolve({ ui5version: "1.0.0" }).resolveId("path1/a/b/c", "path2/a/b/c")).to.eql("path1/a/b/c");
        });
        it("should return override path", async () => {
            expect(ui5Resolve({ ui5version: "1.0.0" }).resolveId("./path1/a/b/c", "path2/a/b/c")).to.eql("path2/a/b/path1/a/b/c");
        });
    });

    describe("when load", () => {
        it("should resolve relative path", async () => {
            sandbox.stub(resourceFactory, "createCollectionsForTree").returns({
                dependencies: {
                    byPath: () => Promise.resolve(
                        resourceFactory.createResource({
                            path: "/path",
                            string: TestUtil.getResource("registration-expected.js")
                        })
                    )
                }
            });
            const expected = fs.readFileSync(path.join(process.cwd(),
                "scripts/rollup/bundleDefinition.js"), { encoding: "utf-8" });
            expect(await ui5Resolve({}).load("bundleDefinition.js")).to.eql(expected);
        });

        it("should resolve relative path", async () => {
            sandbox.stub(resourceFactory, "createCollectionsForTree").returns({
                dependencies: {
                    byPath: () => Promise.resolve(
                        resourceFactory.createResource({
                            path: "/path",
                            string: TestUtil.getResource("registration-expected.js")
                        })
                    )
                }
            });
            expect(await ui5Resolve({}).load("id")).to.eql(TestUtil.getResource("registration-expected.js"));
        });

        it("should resolve relative path", async () => {
            stubDependencies(sandbox);
            const expected = fs.readFileSync(path.join(process.cwd(),
                "scripts/rollup/overrides/sap/ui/thirdparty/URI.js"), { encoding: "utf-8" });
            expect(await ui5Resolve({}).load("sap/ui/thirdparty/URI")).to.eql(expected);
        });
    });

});
function stubDependencies(sandbox: sinon.SinonSandbox) {
    sandbox.stub(resourceFactory, "createCollectionsForTree").returns({
        dependencies: {
            byPath: () => Promise.resolve(
                resourceFactory.createResource({
                    path: "/path",
                    string: TestUtil.getResource("registration-expected.js")
                })
            )
        }
    });
}

