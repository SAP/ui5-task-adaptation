import * as chai from "chai";

import { IConfiguration } from "../../src/model/types.js";
import { renameResources, rename } from "../../src/util/commonUtil.js";
import { validateObject } from "../../src/util/commonUtil.js";
import TestUtil from "./testUtilities/testUtil.js";

const { assert, expect } = chai;

describe("CommonUtil", () => {

    const configuration: IConfiguration = {
        appHostId: "appHostId"
    };

    describe("when validating an object properties", () => {

        it("should throw error if some property doesn't exist", () => {
            try {
                //@ts-ignore otherwise the compiler warns - that is expected
                validateObject(configuration, ["someOther", "andOneMore"], "should be specified");
                assert.fail(true, false, "Exception not thrown");
            } catch (error: any) {
                expect(error.message).to.equal("'someOther' should be specified");
            }
        });

        it("should validate existent property", () => validateObject(configuration, ["appHostId"], "ok"));

    });

    describe("when renaming resources", () => {
        it("should replace search string", () => {
            const search = "test.app"
            const replacement = "bla";
            const input = "This is a apps.test.app (or apps/test/app), really nice apps.test.app (or apps/test/app)"
            const expected = "This is a apps.bla (or apps/bla), really nice apps.bla (or apps/bla)"
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
        it("should replace dot", () => expect(rename("start a.b end", ["a.b"], "x.y.z", [])).to.equal("start x.y.z end"));
        it("should replace dot dot", () => expect(rename("start a.b a.b end", ["a.b"], "x.y.z", [])).to.equal("start x.y.z x.y.z end"));
        it("should replace slash", () => expect(rename("start a/b end", ["a/b"], "x/y/z", [])).to.equal("start x/y/z end"));
        it("should replace slash slash", () => expect(rename("start a/b a/b end", ["a/b"], "x/y/z", [])).to.equal("start x/y/z x/y/z end"));
        it("should replace dot slash", () => expect(rename("start a.b a/b end", ["a.b"], "x.y.z", [])).to.equal("start x.y.z x/y/z end"));
        it("should replace slash dot", () => expect(rename("start a/b a.b end", ["a.b"], "x.y.z", [])).to.equal("start x/y/z x.y.z end"));

        it("should replace dot dot slash", () => expect(rename("start a.b a.b a/b end", ["a.b"], "x.y.z", [])).to.equal("start x.y.z x.y.z x/y/z end"));
        it("should replace dot slash dot", () => expect(rename("start a.b a/b a.b end", ["a.b"], "x.y.z", [])).to.equal("start x.y.z x/y/z x.y.z end"));
        it("should replace slash dot dot", () => expect(rename("start a/b a.b a.b end", ["a.b"], "x.y.z", [])).to.equal("start x/y/z x.y.z x.y.z end"));

        it("should replace slash slash dot", () => expect(rename("start a/b a/b a.b end", ["a.b"], "x.y.z", [])).to.equal("start x/y/z x/y/z x.y.z end"));
        it("should replace slash dot slash", () => expect(rename("start a/b a.b a/b end", ["a.b"], "x.y.z", [])).to.equal("start x/y/z x.y.z x/y/z end"));
        it("should replace dot slash slash", () => expect(rename("start a.b a/b a/b end", ["a.b"], "x.y.z", [])).to.equal("start x.y.z x/y/z x/y/z end"));

        it("should replace search as part of replacement", () => expect(rename("start a.ba.b end", ["a.b"], "a.b.c", [])).to.equal("start a.b.ca.b.c end"));
        it("should replace search as part of replacement", () => expect(rename("start a.b end", ["a.b"], "a.b.c", [])).to.equal("start a.b.c end"));
        it("should replace search as part of replacement", () => expect(rename("start b.a end", ["b.a"], "b.a.c", [])).to.equal("start b.a.c end"));
        it("should replace search as part of replacement", () => expect(rename("start b.a.c.d end", ["a.c"], "b.a.c.d", [])).to.equal("start b.a.c.d end"));

        it("should replace i18n key if not given", () => expect(rename("start {{id_appTitle}} end", ["id"], "customerid", [])).to.equal("start {{customerid_appTitle}} end"));

        it("shouldnt replace i18n key if given", () => expect(rename("start {{id_appTitle}} end", ["id"], "customerid", ["id_appTitle"])).to.equal("start {{id_appTitle}} end"));
        it("shouldnt replace i18n key if multiple given", () => expect(rename("start {{id_appTitle}} end", ["id"], "customerid", ["id_appTitle", "some.id_appTitle"])).to.equal("start {{id_appTitle}} end"));
        it("shouldnt replace i18n key if not containing id", () => expect(rename("start {{id_appTitle}} end", ["id"], "customerid", ["appTitle"])).to.equal("start {{customerid_appTitle}} end"));

        it("should replace dot", () => expect(rename("start a.b end", ["a.b"], "x.y.z", [])).to.equal("start x.y.z end"));
    });


    describe("when renaming resources", () => {
        it("should rename resources with search and replacement", () => {
            const content = TestUtil.getResource("treasury-manifest.json");
            const ignoreInStrings = [
                  "customer.app.variant5_sap.app.title",
                  "appDescription",
                  "customer.app.variant5_sap.app.crossNavigation.inbounds.TreasuryAlert-display.title"
            ];
            const result = JSON.parse(rename(content, ["fin.trm.display.treasury.alerts", "fin.trm.display.treasury.alerts.av5"], "customer.app.variant5", ignoreInStrings));
            expect(result).to.eql(TestUtil.getResourceJson("treasury-manifest-renamed.json"));
        });
    });

    function assertRename(inputString: string, expectedString: string, search: string, replacement: string) {
        const inputFiles = new Map();
        inputFiles.set("1", inputString);
        const renamedFiles = renameResources(inputFiles, [search], replacement);
        expect(renamedFiles.get("1")).to.equal(expectedString);
    }

});