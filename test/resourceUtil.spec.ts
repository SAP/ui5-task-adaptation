import * as chai from "chai";
import ResourceUtil from "../src/util/resourceUtil";
const { expect } = chai;

describe("ResourceUtil", () => {
    it("should return path with project nameespace", () => expect(ResourceUtil.getRootFolder("projectNamespace1")).to.eql("/resources/projectNamespace1"));
    it("should return path without project nameespace", () => expect(ResourceUtil.getRootFolder()).to.eql("/resources"));
});