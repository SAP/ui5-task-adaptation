import * as chai from "chai";
import * as sinon from "sinon";

import { SinonSandbox } from "sinon";
import TestUtil from "../testUtilities/testUtil.js";
import chaiAsPromised from "chai-as-promised";
import esmock from "esmock";
import ui5Resolve from "../../../scripts/rollup/ui5Resolve.js";

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
            expect((await mockUI5Resolve())({}).transform(TestUtil.getResource("registration-bind.js"), "id")).
                to.eql(TestUtil.getResource("registration-bind-expected.js"));
        });

        it("should replace requireAsync", async () => {
            expect((await mockUI5Resolve())({}).transform(TestUtil.getResource("registration.js"), "id")).
                to.eql(TestUtil.getResource("registration-expected.js"));
        });
    });

    describe("when renderChunk", () => {
        it("should add version and window", async () => {
            expect(ui5Resolve({ ui5version: "1.0.0" }).renderChunk("code")).to.eql("var window = {};\ncode");
        });
    });

    describe("when resolveId", () => {
        it("should resolve relative path", async () => {
            expect(ui5Resolve({ ui5version: "1.0.0" }).resolveId("path1/a/b/c", "path2/a/b/c")).to.eql("path1/a/b/c");
        });
        it("should return override path with leading slash", async () => {
            expect(ui5Resolve({ ui5version: "1.0.0" }).resolveId("./path1/a/b/c", "path2/a/b/c")).to.eql("path2/a/b/path1/a/b/c");
        });
    });

});

function mockUI5Resolve() {
    return esmock("../../../scripts/rollup/ui5Resolve.js", {}, {
        "crypto": {
            randomBytes: () => Buffer.from("")
        }
    });
}
