import { expect } from "chai";
import JsonRenamingHandler from "../../../../src/util/renamingHandlers/jsonRenamingHandler.js";

class TestJsonHandler extends JsonRenamingHandler {
    filePath = "test.json";
    jsonPathsToRestore: string[];

    constructor(pathsToRestore: string[]) {
        super();
        this.jsonPathsToRestore = pathsToRestore;
    }

    // Expose protected methods for testing
    public testStore(obj: any, path: string) {
        this.store(obj, path);
    }

    public testRestore(obj: any) {
        this.restore(obj);
    }
}

describe("JsonRenamingHandler", () => {
    it("should accept only its own file", () => {
        const handler = new TestJsonHandler(["a/b"]);
        expect(handler.accept("test.json")).to.be.true;
        expect(handler.accept("manifest.json")).to.be.false;
    });

    it("should not throw when storing a path with missing intermediate properties", () => {
        const handler = new TestJsonHandler(["a/b/c"]);
        expect(() => handler.before({ a: {} })).to.not.throw();
    });

    it("should not throw when restoring a path with missing intermediate properties", () => {
        const handler = new TestJsonHandler(["a/b/c"]);
        const json = { a: {} };
        handler.before(json);
        expect(() => handler.after(json)).to.not.throw();
    });

    it("should handle a completely non-existent path gracefully", () => {
        const handler = new TestJsonHandler(["x/y/z"]);
        const json = { a: { b: 2 } };
        expect(() => handler.before(json)).to.not.throw();
        expect(() => handler.after(json)).to.not.throw();
    });

    it("should restore a value into a JSON object in-place preserving the reference", () => {
        const handler = new TestJsonHandler(["a/b"]);
        const json = { a: { b: "original" } };
        handler.before(json);
        json.a.b = "renamed";
        handler.after(json);
        expect(json.a.b).to.equal("original");
    });

    it("should mutate the same JSON object reference passed to after", () => {
        const handler = new TestJsonHandler(["a/b"]);
        const json = { a: { b: "original" } };
        handler.before(json);
        json.a.b = "renamed";
        const before = json;
        handler.after(json);
        expect(json).to.equal(before);
    });
});
