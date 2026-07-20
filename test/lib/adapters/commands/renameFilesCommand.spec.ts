import { expect } from "chai";
import { xml2js } from "xml-js";
import RenameFilesCommand, { restoreWhatShouldntBeRenamed } from "../../../../src/adapters/commands/renameFilesCommand.js";
import { renameJson } from "../../../../src/util/renamingUtil.js";
import { toBuffer } from "../../testUtilities/testUtil.js";

describe("rename", () => {
    let renamedFiles: Map<string, Buffer>;
    let manifest: any;
    let viewXml: any;

    before(async () => {
        const files = new Map<string, Buffer>();
        files.set("manifest.json", toBuffer(JSON.stringify({
            "sap.app": {
                "id": "my.app"
            },
            "sap.ui5": {
                "dependencies": {
                    "libs": {
                        "my.app.reuse.lib": {}
                    },
                    "components": {
                        "my.app.reuse.component": {}
                    }
                }
            }
        })));
        files.set("view.xml", toBuffer(`
<mvc:View xmlns:alias="my.app.reuse.lib" xmlns:mvc="sap.ui.core.mvc" controllerName="my.app.Controller">
    <core:ComponentContainer name="my.app.reuse.component"/>
</mvc:View>`)); // referenced my.app.reuse.lib and "my.app.reuse.component"
        files.set("controller.js", toBuffer(`
sap.ui.define(['my.app.reuse.lib'], function (myAppReuseLib) {
    const appId = "my.app";
    sap.ui.core.Component.create({
        name: "my.app.reuse.component",
    });
});`)); // referenced "my.app.reuse.lib" and "my.app.reuse.component"

        const references = new Map<string, string>([
            ["my.app", "customer.app"]
        ]);

        renamedFiles = new Map<string, Buffer>(files);
        const command = new RenameFilesCommand(references);
        await command.execute(renamedFiles);
        manifest = JSON.parse(renamedFiles.get("manifest.json")!.toString("utf8"));
        viewXml = xml2js(renamedFiles.get("view.xml")!.toString("utf8"), { compact: true });
    });

    it("should rename the application id in manifest.json", () => {
        expect(manifest["sap.app"].id).to.equal("customer.app");
    });

    it("should not rename dependency libs in manifest.json", () => {
        const dependencies = manifest["sap.ui5"].dependencies;
        expect(Object.keys(dependencies.libs)).to.deep.equal(["my.app.reuse.lib"]);
    });

    it("should not rename dependency components in manifest.json", () => {
        const dependencies = manifest["sap.ui5"].dependencies;
        expect(Object.keys(dependencies.components)).to.deep.equal(["my.app.reuse.component"]);
    });

    it("should rename controllerName in view.xml since it matches the application id", () => {
        expect(viewXml["mvc:View"]._attributes.controllerName).to.equal("customer.app.Controller");
    });

    it("should not rename xmlns:alias in view.xml since it matches the dependency lib", () => {
        expect(viewXml["mvc:View"]._attributes["xmlns:alias"]).to.equal("my.app.reuse.lib");
    });

    it("should not rename name in view.xml since it matches the dependency component", () => {
        expect(viewXml["mvc:View"]["core:ComponentContainer"]._attributes.name).to.equal("my.app.reuse.component");
    });

    it("should rename appId in controller.js but not dependency libs or components", () => {
        const controllerJs = renamedFiles.get("controller.js")?.toString("utf8");
        expect(controllerJs).to.equal(`
sap.ui.define(['my.app.reuse.lib'], function (myAppReuseLib) {
    const appId = "customer.app";
    sap.ui.core.Component.create({
        name: "my.app.reuse.component",
    });
});`);
    });
});

describe("restoreWhatShouldntBeRenamed", () => {
    let renamedManifest: any;

    before(() => {
        const manifest = {
            "sap.app": {
                "id": "original.id"
            },
            "sap.ui5": {
                "appVariantIdHierarchy": [{
                    "appVariantId": "original.id",
                }],
                "dependencies": {
                    "libs": {
                        "sap.original.id.reuse": {}
                    }
                }
            }
        };
        const files = new Map<string, Buffer>([["manifest.json", toBuffer(JSON.stringify(manifest))]]);
        const references = new Map<string, string>([
            ["original.id", "customer.app.var.id"]
        ]);
        const command = new RenameFilesCommand(references);
        command.execute(files);
        renamedManifest = JSON.parse(files.get("manifest.json")!.toString("utf8"));
    });

    it("should restore appVariantIdHierarchy", () => {
        expect(renamedManifest["sap.ui5"].appVariantIdHierarchy[0].appVariantId).to.equal("original.id");
    });
    it("should restore dependencies", () => {
        expect(renamedManifest["sap.ui5"].dependencies.libs["sap.original.id.reuse"]).to.exist;
    });
    it("should rename sap.app id", () => {
        expect(renamedManifest["sap.app"].id).to.equal("customer.app.var.id");
    });
});

describe("restoreWhatShouldntBeRenamed with a files map", () => {
    let renamedManifest: any;

    before(() => {
        const manifest = {
            "sap.app": {
                "id": "original.id"
            },
            "sap.ui5": {
                "appVariantIdHierarchy": [{
                    "appVariantId": "original.id",
                }]
            }
        };
        const files = new Map<string, Buffer>([["manifest.json", toBuffer(JSON.stringify(manifest))]]);
        const references = new Map<string, string>([
            ["original.id", "customer.app.var.id"]
        ]);
        const descriptor: PropertyDescriptor = {
            value(fileMap: Map<string, Buffer>, refs: Map<string, string>): void {
                for (const [filename, content] of fileMap) {
                    const json = JSON.parse(content.toString("utf8"));
                    renameJson(json, refs, [...refs.values()]);
                    fileMap.set(filename, toBuffer(JSON.stringify(json)));
                }
            }
        };
        restoreWhatShouldntBeRenamed()({}, "rename", descriptor);
        descriptor.value(files, references);
        renamedManifest = JSON.parse(files.get("manifest.json")!.toString("utf8"));
    });

    it("should rename sap.app id in the file", () => {
        expect(renamedManifest["sap.app"].id).to.equal("customer.app.var.id");
    });

    it("should restore appVariantIdHierarchy in the file", () => {
        expect(renamedManifest["sap.ui5"].appVariantIdHierarchy[0].appVariantId).to.equal("original.id");
    });
});
