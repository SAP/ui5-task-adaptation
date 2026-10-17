import { expect } from "chai";

import { buildCommitMessage, conventionalTypeForIncrement, getConventionalType } from "../../scripts/publish.js";

describe("publish: getConventionalType", () => {

    it("reuses the type from a conventional subject", () => {
        expect(getConventionalType("feat: add new property")).to.equal("feat");
        expect(getConventionalType("fix: correct schema")).to.equal("fix");
    });

    it("reuses the type when a scope is present", () => {
        expect(getConventionalType("feat(sap.card): add badges")).to.equal("feat");
    });

    it("reuses the type for a breaking-change `!`", () => {
        expect(getConventionalType("refactor!: drop legacy field")).to.equal("refactor");
        expect(getConventionalType("feat(sap.app)!: breaking change")).to.equal("feat");
    });

    it("is case-insensitive and normalizes to lower case", () => {
        expect(getConventionalType("FIX: something")).to.equal("fix");
    });

    it("only inspects the subject line, not the body", () => {
        expect(getConventionalType("feat: add X\n\nfix: unrelated body line")).to.equal("feat");
    });

    it("falls back to `feat` for a non-conventional subject", () => {
        expect(getConventionalType("Release 1.6.8")).to.equal("feat");
        expect(getConventionalType("Merge pull request #620")).to.equal("feat");
    });

    it("falls back to `feat` for an unknown type", () => {
        expect(getConventionalType("wip: in progress")).to.equal("feat");
    });

    it("falls back to `feat` for an undefined/empty message", () => {
        expect(getConventionalType(undefined)).to.equal("feat");
        expect(getConventionalType("")).to.equal("feat");
    });

});

describe("publish: conventionalTypeForIncrement", () => {

    it("maps patch to fix", () => {
        expect(conventionalTypeForIncrement("patch")).to.equal("fix");
    });

    it("maps minor and major to feat", () => {
        expect(conventionalTypeForIncrement("minor")).to.equal("feat");
        expect(conventionalTypeForIncrement("major")).to.equal("feat");
    });

    it("returns undefined when no increment is given", () => {
        expect(conventionalTypeForIncrement(undefined)).to.equal(undefined);
        expect(conventionalTypeForIncrement("")).to.equal(undefined);
        expect(conventionalTypeForIncrement("bogus")).to.equal(undefined);
    });

});

describe("publish: buildCommitMessage", () => {

    it("builds a conventional subject with body and source-commit reference", () => {
        const message = buildCommitMessage("1.6.8", {
            message: "feat: add badges\n\nAdds badge support to cards.",
            sha: "3fe902b"
        });
        expect(message).to.equal(
            "feat: Release 1.6.8\n\n" +
            "feat: add badges\n\nAdds badge support to cards.\n\n" +
            "Source-commit: 3fe902b");
    });

    it("uses `feat` when the triggering commit is not conventional", () => {
        const message = buildCommitMessage("1.6.8", {
            message: "Release 1.6.8",
            sha: "55e7c3e"
        });
        expect(message).to.equal(
            "feat: Release 1.6.8\n\n" +
            "Release 1.6.8\n\n" +
            "Source-commit: 55e7c3e");
    });

    it("produces a plain release subject when no triggering commit is available", () => {
        expect(buildCommitMessage("1.6.8", undefined)).to.equal("feat: Release 1.6.8");
    });

    it("uses fix when the increment is patch, overriding the triggering commit type", () => {
        const message = buildCommitMessage("1.6.9", {
            message: "feat: add badges",
            sha: "3fe902b"
        }, "patch");
        expect(message).to.equal(
            "fix: Release 1.6.9\n\n" +
            "feat: add badges\n\n" +
            "Source-commit: 3fe902b");
    });

    it("uses feat when the increment is minor", () => {
        expect(buildCommitMessage("1.6.8", undefined, "minor")).to.equal("feat: Release 1.6.8");
    });

});
