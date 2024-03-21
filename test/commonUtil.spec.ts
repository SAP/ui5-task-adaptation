import * as chai from "chai";

import { IConfiguration } from "../src/model/types.js";
import { renameResources } from "../src/util/commonUtil.js";
import { validateObject } from "../src/util/commonUtil.js";

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

    function assertRename(inputString: string, expectedString: string, search: string, replacement: string) {
        const inputFiles = new Map();
        inputFiles.set("1", inputString);
        const renamedFiles = renameResources(inputFiles, search, replacement);
        expect(renamedFiles.get("1")).to.equal(expectedString);
    }

});