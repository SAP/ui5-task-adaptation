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
    it("should not throw when storing a path with missing intermediate properties", () => {
        const handler = new TestJsonHandler(["a/b/c"]);
        const files = new Map<string, string>([
            ["test.json", JSON.stringify({ a: {} })]
        ]);
        expect(() => handler.before(files)).to.not.throw();
    });

    it("should not throw when restoring a path with missing intermediate properties", () => {
        const handler = new TestJsonHandler(["a/b/c"]);
        const files = new Map<string, string>([
            ["test.json", JSON.stringify({ a: {} })]
        ]);
        handler.before(files);
        const newFiles = new Map(files);
        expect(() => handler.after(newFiles)).to.not.throw();
    });

    it("should handle a completely non-existent path gracefully", () => {
        const handler = new TestJsonHandler(["x/y/z"]);
        const files = new Map<string, string>([
            ["test.json", JSON.stringify({ a: { b: 2 } })]
        ]);
        expect(() => handler.before(files)).to.not.throw();
        const newFiles = new Map(files);
        expect(() => handler.after(newFiles)).to.not.throw();
    });
});
