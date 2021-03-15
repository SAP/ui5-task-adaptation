import * as chai from "chai";
import ResourceUtil from "../src/util/resourceUtil";
const { expect } = chai;

describe("ResourceUtil", () => {

    describe("when getting root folder", () => {
        it("should return path with project namespace", () => expect(ResourceUtil.getRootFolder("projectNamespace1")).to.eql("/resources/projectNamespace1"));
        it("should return path without project namespace", () => expect(ResourceUtil.getRootFolder()).to.eql("/resources"));
    });

    describe("when writing reading base app files", () => {
        after(() => ResourceUtil.deleteTemp("baseAppId"));

        it("should return empty map for non-existing temp folder", async () => {
            const result = await ResourceUtil.readTemp("baseAppId");
            expect(result.size).to.equal(0);
        });

        it("should return files for existing temp folder", async () => {
            const files = new Map([["/folder1/file1", "file1Content"], ["/file2", "file2Content"]]);
            await ResourceUtil.writeTemp(files, "baseAppId");
            const result = await ResourceUtil.readTemp("baseAppId");
            expect(result.size).to.equal(2);
            expect(result.get("/folder1/file1")).to.equal("file1Content");
            expect(result.get("/file2")).to.equal("file2Content");
        });
    });

});