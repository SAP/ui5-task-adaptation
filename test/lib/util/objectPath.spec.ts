import { expect } from "chai";
import { set, get } from "../../../src/util/objectPath.js";

describe("objectPath.set", () => {
    it("should set nested value with dot path", () => {
        const root: any = {};
        set(root, "a.b.c", 5);
        expect(root).to.eql({ a: { b: { c: 5 } } });
    });

    it("should set nested value with array path", () => {
        const root: any = {};
        set(root, ["x", "y"], true);
        expect(root).to.eql({ x: { y: true } });
    });

    it("should overwrite non-object segment", () => {
        const root: any = { a: 1 };
        set(root, "a.b", 2);
        expect(root).to.eql({ a: { b: 2 } });
    });

    it("should overwrite null segment", () => {
        const root: any = { a: null };
        set(root, "a.b", 1);
        expect(root).to.eql({ a: { b: 1 } });
    });

    it("should reuse existing objects", () => {
        const root: any = { a: { b: { c: 1 } } };
        set(root, "a.b.c", 3);
        expect(root).to.eql({ a: { b: { c: 3 } } });
    });

    it("should reuse existing objects", () => {
        const root: any = { a: { b: { c: [1] } } };
        get<number[]>(root, "a.b.c", []).unshift(0);
        expect(root).to.eql({ a: { b: { c: [0, 1] } } });
    });
});
