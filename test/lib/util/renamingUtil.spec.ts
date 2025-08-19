import { expect } from "chai";
import { rename, renameResources } from "../../../src/util/renamingUtil.js";
import TestUtil from "../testUtilities/testUtil.js";

describe("when renaming resources", () => {
    it("should replace search string", () => {
        const search = "test.app"
        const replacement = "b.la";
        const input = "This is a apps.test.app (or apps/test/app), really nice apps.test.app (or apps/test/app)"
        const expected = "This is a apps.b.la (or apps/b/la), really nice apps.b.la (or apps/b/la)"
        assertRename(input, expected, search, replacement);
    });

    it("should replace search string but not if it is a substring", () => {
        const search = "test.app"
        const replacement = "customer.ns.test.app.var";
        const input = "This is a test.app (or test/app), really nice test.app (or test/app), but not a customer.ns.test.app.var (or customer/ns/test/app/var), I repeat - not a customer.ns.test.app.var (or customer/ns/test/app/var)"
        const expected = "This is a customer.ns.test.app.var (or customer/ns/test/app/var), really nice customer.ns.test.app.var (or customer/ns/test/app/var), but not a customer.ns.test.app.var (or customer/ns/test/app/var), I repeat - not a customer.ns.test.app.var (or customer/ns/test/app/var)"
        assertRename(input, expected, search, replacement);
    });

    it("should escape special characters and replace search string", () => {
        const search = "test-[]/{}()*+?^$|.app"
        const replacement = "customer.ns.test-[]/{}()*+?^$|.app.var";
        const input = "This is a apps/test-[]/{}()*+?^$|.app (or apps/test-[]/{}()*+?^$|/app), really nice apps/test-[]/{}()*+?^$|.app (or apps/test-[]/{}()*+?^$|/app), but not a customer.ns.test-[]/{}()*+?^$|.app.var (or customer/ns/test-[]/{}()*+?^$|/app/var)"
        const expected = "This is a apps/customer.ns.test-[]/{}()*+?^$|.app.var (or apps/customer/ns/test-[]/{}()*+?^$|/app/var), really nice apps/customer.ns.test-[]/{}()*+?^$|.app.var (or apps/customer/ns/test-[]/{}()*+?^$|/app/var), but not a customer.ns.test-[]/{}()*+?^$|.app.var (or customer/ns/test-[]/{}()*+?^$|/app/var)"
        assertRename(input, expected, search, replacement);
    });

    it("should replace search string without dots with replacement with dots", () => {
        const search = "zroomv2.fs"
        const replacement = "customer.deploytestzroomv2.fs.variant1";
        const input = "This is a url1/zroomv2.fs/url2"
        const expected = "This is a url1/customer.deploytestzroomv2.fs.variant1/url2"
        assertRename(input, expected, search, replacement);
    });

    it("should replace search string with protocol chars", () => {
        const search = "zroomv2.fs"
        const replacement = "cust.omer.zroomv2.fs.variant1";
        const input = "ui5://zroomv2.fs/img/pic.jpg";
        const expected = "ui5://cust.omer.zroomv2.fs.variant1/img/pic.jpg";
        assertRename(input, expected, search, replacement);
    });

    it("should not replace search string being part of replacement with protocol chars", () => {
        const search = "zroomv2.fs"
        const replacement = "cust.omer.zroomv2.fs.variant1";
        const input = "ui5://cust.omer.zroomv2.fs.variant1/img/pic.jpg";
        const expected = "ui5://cust.omer.zroomv2.fs.variant1/img/pic.jpg";
        assertRename(input, expected, search, replacement);
    });

    it("should not replace search string being part of replacement in input with slashes", () => {
        const search = "zroomv2.fs"
        const replacement = "customer.zroomv2.fs.variant1";
        const input = "customer/zroomv2/fs/variant1/changes/fragments/ConsumerCopyRoomButton.fragment.xml"
        const expected = "customer/zroomv2/fs/variant1/changes/fragments/ConsumerCopyRoomButton.fragment.xml"
        assertRename(input, expected, search, replacement);
    });

    it("should not replace search string being part of replacement in input with dots", () => {
        const search = "zroomv2.fs"
        const replacement = "customer.zroomv2.fs.variant1";
        const input = "customer.zroomv2.fs.variant1.changes.fragments.ConsumerCopyRoomButton.fragment.xml"
        const expected = "customer.zroomv2.fs.variant1.changes.fragments.ConsumerCopyRoomButton.fragment.xml"
        assertRename(input, expected, search, replacement);
    });

    it("should not replace search string being part of complex replacement in input with dots", () => {
        const search = "zroomv2.fs"
        const replacement = "cust.omer.zroomv2.fs.variant1";
        const input = "cust.omer.zroomv2.fs.variant1.changes.fragments.ConsumerCopyRoomButton.fragment.xml"
        const expected = "cust.omer.zroomv2.fs.variant1.changes.fragments.ConsumerCopyRoomButton.fragment.xml"
        assertRename(input, expected, search, replacement);
    });

    it("should not replace search string being part of complex replacement in input with slashes", () => {
        const search = "zroomv2.fs"
        const replacement = "cust.omer.zroomv2.fs.variant1";
        const input = "cust/omer/zroomv2/fs/variant1/changes/fragments/ConsumerCopyRoomButton.fragment.xml"
        const expected = "cust/omer/zroomv2/fs/variant1/changes/fragments/ConsumerCopyRoomButton.fragment.xml"
        assertRename(input, expected, search, replacement);
    });
});

describe("when renaming", () => {
    describe("when renaming resources", () => {
        it("should rename resources with search and replacement", () => {
            const content = TestUtil.getResource("treasury-manifest.json");
            const result = JSON.parse(rename(content, ["fin.trm.display.treasury.alerts"], "customer.app.variant5"));
            expect(result).to.eql(TestUtil.getResourceJson("treasury-manifest-renamed.json"));
        });
    });

    describe("having single base id", () => {
        const assert = (content: string, expected: string, message: string) => {
            const actual = rename(content, ["base.app"], "base.app.variant");
            it(message, () => expect(actual).to.equal(expected));
        };
        assert("base.app", "base.app.variant", "should rename id");
        assert("base/app", "base/app/variant", "should rename id w. slash");
        assert("base.app base/app", "base.app.variant base/app/variant", "should rename id w./wo. slash");
        assert("base/app base.app", "base/app/variant base.app.variant", "should rename id w./wo. slash diff order");

        // should not rename
        assert("base.app.variant", "base.app.variant", "shouldnt rename adaptation project id");
        it("shouldnt rename adaptation project id", () => {
            const actual = rename("fin.trm.display.treasury.alerts", ["fin.trm.display.treasury.alerts"], "fin.trm.display.treasury.alerts.av");
            expect(actual).to.equal("fin.trm.display.treasury.alerts.av");
        });
    });
});


describe("when renaming base ids in random order", () => {
    const content = [
        "base.id",
        "base/id",
        "base.id.variant",
        "base/id/variant",
        "base.appvar1",
        "base/appvar1",
        "customer.base.appvar1",
        "customer/base/appvar1"
    ];
    const shuffled = TestUtil.permuteArray(content);
    it(`should rename ${shuffled.length} variants`, () => {
        for (const array of shuffled) {
            const stringFormArray = array.join(" ");
            const renamed = rename(stringFormArray, ["base.id", "base.id.variant", "base.appvar1"], "customer.base.appvar1");
            expect([...new Set(renamed.split(" ").toSorted())], `should've renamed '${stringFormArray}'`).to.have.members(["customer.base.appvar1", "customer/base/appvar1"]);
        }
    });
});

describe("when some search or replacement don't have a dot should ignore renaming", () => {
    it("when search has a dot and replacement doesn't", () => {
        expect(rename("base.id", ["base.id"], "customerbaseappvar1")).to.eql("base.id");
    });
    it("when search doesn't have a dot and replacement does", () => {
        expect(rename("base.id", ["baseid"], "customer.base.appvar1")).to.eql("base.id");
    });
    it("should rename if one of search terms doesn't have a dot and replacement doesnt", () => {
        expect(rename("base.id", ["baseid", "base.id"], "customerbaseappvar1")).to.eql("base.id");
    });
    it("when one of search terms doesn't have a dot and replacement does", () => {
        expect(rename("base.id", ["baseid", "base.id"], "customer.base.appvar1")).to.eql("customer.base.appvar1");
    });
});

function assertRename(inputString: string, expectedString: string, search: string, replacement: string) {
    const inputFiles = new Map();
    inputFiles.set("1", inputString);
    const renamedFiles = renameResources(inputFiles, [search], replacement);
    expect(renamedFiles.get("1")).to.equal(expectedString);
}
