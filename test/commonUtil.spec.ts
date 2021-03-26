import * as chai from "chai";

import { IConfiguration } from "../src/model/types";
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
            } catch (error) {
                expect(error.message).to.equal("'someOther' should be specified");
            }
        });

        it("should validate existent property", () => validateObject(configuration, ["appHostId"], "ok"));

    });

});