import * as chai from "chai";

import { merge } from "../../../../src/util/cf/xsAppJsonUtil.js";

const { expect } = chai;

describe("xsAppJsonUtil.merge", () => {
    it("returns undefined for empty input", () => {
        const result = merge([]);
        expect(result).to.be.undefined;
    });

    it("returns same content for single input", () => {
        const singleObj = { authenticationMethod: "route", routes: [] };
        const single = JSON.stringify(singleObj);
        const result = merge([single]);
        expect(result).to.be.a("string");
        expect(JSON.parse(result!)).to.deep.equal(singleObj);
    });

    it("merges multiple xs-app.json contents: first welcomeFile/authMethod, concatenated routes", () => {
        const appVariant = JSON.stringify({
            welcomeFile: "/variant/",
            authenticationMethod: "route",
            routes: [
                { source: "^/variant/(.*)$", target: "/$1", destination: "v" }
            ]
        });
        const reuseLib = JSON.stringify({
            authenticationMethod: "none",
            routes: [
                { source: "^/lib/(.*)$", target: "/$1", destination: "l" }
            ]
        });
        const baseApp = JSON.stringify({
            welcomeFile: "/base/",
            authenticationMethod: "route",
            routes: [
                { source: "^/resources/(.*)$", target: "/resources/$1", destination: "ui5" }
            ]
        });

        const result = merge([appVariant, reuseLib, baseApp]);
        expect(result).to.be.a("string");
        const merged = JSON.parse(result!);
        const expected = {
            welcomeFile: "/variant/",
            authenticationMethod: "route",
            routes: [{
                source: "^/variant/(.*)$",
                target: "/$1",
                destination: "v"
            },
            {
                source: "^/lib/(.*)$",
                target: "/$1",
                destination: "l"
            },
            {
                source: "^/resources/(.*)$",
                target: "/resources/$1",
                destination: "ui5"
            }]
        };
        expect(merged).to.deep.equal(expected);
    });
});
