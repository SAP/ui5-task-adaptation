const assert = require("assert");
const { Change } = require("../dist/bundle");

describe("change", () => {
    const change = new Change({
        content: "content",
        changeType: "change",
        texts: ["text"]
    });
    it("should have content", () => assert.deepEqual(change.getContent(), "content"));
    it("should have change", () => assert.deepEqual(change.getChangeType(), "change"));
    it("should have text", () => assert.deepEqual(change.getTexts(), ["text"]));
});
