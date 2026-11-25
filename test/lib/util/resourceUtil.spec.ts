import { expect } from "chai";
import ResourceUtil from "../../../src/util/resourceUtil.js";

function makeResource(resourcePath: string, content = "data"): any {
    return {
        getPath: () => resourcePath,
        getBuffer: async () => Buffer.from(content),
    };
}

describe("ResourceUtil.toFileMap", () => {
    it("strips the namespace prefix when path starts with projectNamespace root", async () => {
        const ns = "my/app/ns";
        const resources = [
            makeResource("/resources/my/app/ns/Component.js"),
            makeResource("/resources/my/app/ns/manifest.json"),
        ];
        const result = await ResourceUtil.toFileMap(resources, ns);
        expect([...result.keys()]).to.deep.equal(["Component.js", "manifest.json"]);
    });

    it("falls back to stripping only the leading slash when path does not start with projectNamespace root", async () => {
        const ns = "my/app/ns";
        const resources = [
            makeResource("/other/path/file.js"),
        ];
        const result = await ResourceUtil.toFileMap(resources, ns);
        expect([...result.keys()]).to.deep.equal(["other/path/file.js"]);
    });

    it("strips only the leading slash when no projectNamespace is provided", async () => {
        const resources = [
            makeResource("/some/file.js"),
            makeResource("/another/file.json"),
        ];
        const result = await ResourceUtil.toFileMap(resources, undefined);
        expect([...result.keys()]).to.deep.equal(["some/file.js", "another/file.json"]);
    });

    it("preserves buffer content", async () => {
        const ns = "my/app/ns";
        const resources = [makeResource("/resources/my/app/ns/Component.js", "hello")];
        const result = await ResourceUtil.toFileMap(resources, ns);
        expect(result.get("Component.js")?.toString()).to.equal("hello");
    });
});
