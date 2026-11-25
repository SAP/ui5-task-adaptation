import { expect } from "chai";
import XsAppJsonMergeCommand from "../../../../src/adapters/commands/xsAppJsonMergeCommand.js";
import { XSAPP_JSON_FILENAME } from "../../../../src/util/cf/xsAppJsonUtil.js";
import { bufferToJson } from "../../../../src/util/commonUtil.js";


describe("CFAdapter", () => {
    it("merges xs-app.json from base and appVariant", async () => {
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

        const files = new Map<string, Buffer>([[XSAPP_JSON_FILENAME, Buffer.from(JSON.stringify(baseXsApp))]]);
        await new XsAppJsonMergeCommand().execute(files, XSAPP_JSON_FILENAME, Buffer.from(JSON.stringify(variantXsApp)));
        const merged = bufferToJson(files.get(XSAPP_JSON_FILENAME)!);
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

    it("does not modify xs-app.json if appVariant is empty", async () => {
        const baseXsApp = {
            welcomeFile: "/",
            authenticationMethod: "route",
            routes: [
                { source: "^/(.*)$", target: "/$1", destination: "general" }
            ]
        };

        const files = new Map<string, Buffer>([[XSAPP_JSON_FILENAME, Buffer.from(JSON.stringify(baseXsApp))]]);
        await expect(new XsAppJsonMergeCommand().execute(files, XSAPP_JSON_FILENAME, Buffer.from("{invalidJson}")))
            .to.be.rejectedWith("Failed to parse xs-app.json content: Expected property name or '}' in JSON at position 1");
    });

    it("does not modify xs-app.json if appVariant is invalid JSON", async () => {
        const files = new Map<string, Buffer>([[XSAPP_JSON_FILENAME, Buffer.from(JSON.stringify({}))]]);
        await expect(new XsAppJsonMergeCommand().execute(files, XSAPP_JSON_FILENAME, Buffer.from("{invalidJson}")))
            .to.be.rejectedWith("Failed to parse xs-app.json content: Expected property name or '}' in JSON at position 1");
    });

    it("modifies xs-app.json if appVariant is missing routes", async () => {
        const baseXsApp = {
            welcomeFile: "/",
            authenticationMethod: "route",
            routes: [
                { source: "^/(.*)$", target: "/$1", destination: "general" }
            ]
        };

        const variantXsApp = {
            welcomeFile: "/comfioritoolstravel/",
            authenticationMethod: "route"
        };

        const files = new Map<string, Buffer>([[XSAPP_JSON_FILENAME, Buffer.from(JSON.stringify(baseXsApp))]]);
        await new XsAppJsonMergeCommand().execute(files, XSAPP_JSON_FILENAME, Buffer.from(JSON.stringify(variantXsApp)));
        const merged = bufferToJson(files.get(XSAPP_JSON_FILENAME)!);
        expect(merged).to.deep.equal({
            welcomeFile: "/comfioritoolstravel/",
            authenticationMethod: "route",
            routes: [
                { source: "^/(.*)$", target: "/$1", destination: "general" }
            ]
        });
    });

    it("modifies xs-app.json if appVariant is missing authenticationMethod", async () => {
        const baseXsApp = {
            welcomeFile: "/",
            authenticationMethod: "route",
            routes: [
                { source: "^/(.*)$", target: "/$1", destination: "general" }
            ]
        };

        const variantXsApp = {
            welcomeFile: "/comfioritoolstravel/",
            routes: [
                { source: "^/(.*)$", target: "/$1", destination: "general-override" }
            ]
        };

        const files = new Map<string, Buffer>([[XSAPP_JSON_FILENAME, Buffer.from(JSON.stringify(baseXsApp))]]);
        await new XsAppJsonMergeCommand().execute(files, XSAPP_JSON_FILENAME, Buffer.from(JSON.stringify(variantXsApp)));
        const merged = bufferToJson(files.get(XSAPP_JSON_FILENAME)!);
        expect(merged).to.deep.equal({
            welcomeFile: "/comfioritoolstravel/",
            authenticationMethod: "route",
            routes: [
                { source: "^/(.*)$", target: "/$1", destination: "general-override" },
                { source: "^/(.*)$", target: "/$1", destination: "general" }
            ]
        });
    });
});
