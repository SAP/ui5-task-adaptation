import * as chai from "chai";

import CFAdapter from "../../../src/adapters/cfAdapter.js";
import { XSAPP_JSON_FILENAME } from "../../../src/util/cf/xsAppJsonUtil.js";

const { expect } = chai;

describe("CFAdapter", () => {
    it("merges xs-app.json from base and appVariant", async () => {
        const adapter = new CFAdapter();
        const baseXsApp = {
            welcomeFile: "/",
            authenticationMethod: "route",
            routes: [
                { source: "^/(.*)$", target: "/$1", destination: "general" }
            ]
        };

        const variantXsApp = {
            welcomeFile: "/comfioritoolstravel/",
            authenticationMethod: "route",
            routes: [
                { source: "^/(.*)$", target: "/$1", destination: "general-override" }
            ]
        };

        const files = new Map<string, string>([[XSAPP_JSON_FILENAME, JSON.stringify(baseXsApp)]]);
        const appVariantFiles = new Map<string, string>([[XSAPP_JSON_FILENAME, JSON.stringify(variantXsApp)]]);

        const adapted = await adapter.adapt(files, appVariantFiles);
        const merged = JSON.parse(adapted.get(XSAPP_JSON_FILENAME)!);
        expect(merged.welcomeFile).to.equal("/comfioritoolstravel/");
        expect(merged.authenticationMethod).to.equal("route");
        expect(merged.routes).to.deep.equal([
            {
                source: "^/(.*)$",
                target: "/$1",
                destination: "general-override"
            },
            {
                source: "^/(.*)$",
                target: "/$1",
                destination: "general"
            }
        ]);
    });

});
