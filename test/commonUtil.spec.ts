import * as chai from "chai";

import { IConfiguration } from "../src/model/types";
import { renameResources } from "../src/util/commonUtil";
import { validateObject } from "../src/util/commonUtil";

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
            const input = "This is a apps/test.app (or apps/test/app), really nice apps/test.app (or apps/test/app)"
            const expected = "This is a apps/bla (or apps/bla), really nice apps/bla (or apps/bla)"
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
    });

    function assertRename(inputString: string, expectedString: string, search: string, replacement: string) {
        const inputFiles = new Map();
        inputFiles.set("1", inputString);
        const renamedFiles = renameResources(inputFiles, search, replacement);
        expect(renamedFiles.get("1")).to.equal(expectedString);
    }

});