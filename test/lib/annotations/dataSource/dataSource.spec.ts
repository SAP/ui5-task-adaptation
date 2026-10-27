import DataSource from "../../../../src/annotations/dataSource/dataSource.js";
import { expect } from "chai";

describe("DataSource", () => {

    describe("constructor name validation", () => {

        const validNames = [
            "mainService",
            "ANNOTATION_1",
            "my.data-source",
            "a",
            "A.B_C-D",
        ];

        for (const name of validNames) {
            it(`should accept valid name '${name}'`, () => {
                expect(() => new (DataSource as any)(name, "/uri")).to.not.throw();
            });
        }

        const invalidNames = [
            "name with spaces",
            "name/with/slash",
            "name<script>",
            "name>",
            "name&value",
            "safe\n",
            // URL injection
            "../traversal",
            "name?param=val",
            "name#fragment",
            "name%2Fencoded",
            "",
        ];

        for (const name of invalidNames) {
            it(`should throw for invalid name '${name}'`, () => {
                expect(() => new (DataSource as any)(name, "/uri"))
                    .to.throw(`Invalid dataSource name '${name}'`);
            });
        }

    });

});
