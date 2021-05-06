import * as chai from "chai";
import * as sinon from "sinon";

import { IAppVariantInfo, IProjectOptions } from "../src/model/types";

import BaseAppManager from "../src/baseAppManager";
import { SinonSandbox } from "sinon";
import TestUtil from "./util/testUtil";

const { expect, assert } = chai;

describe("BaseAppManager", () => {
    let appVariantInfo: IAppVariantInfo;
    let sandbox: SinonSandbox;
    const options: IProjectOptions = {
        projectNamespace: "ns",
        configuration: {
            appHostId: "appHostId",
            appId: "appId",
            appName: "appName",
            appVersion: "appVersion",
            spaceGuid: "spaceGuid",
            orgGuid: "orgGuid",
            sapCloudService: "sapCloudService"
        }
    };

    beforeEach(async () => sandbox = sinon.createSandbox());
    afterEach(() => sandbox.restore());

    before(async () => {
        appVariantInfo = await TestUtil.getAppVariantInfo("appVariant1");
    });

    it("should update base app manifest", async () => {
        const baseAppFiles = new Map([
            ["manifest.json", TestUtil.getResource("manifest.json")],
            ["component-preload.js", TestUtil.getResource("component-preload.js")]
        ]);
        const resources = await BaseAppManager.process(baseAppFiles, appVariantInfo, options);
        const actualManifest = await TestUtil.getResourceByName(resources, "manifest.json").then(buffer => JSON.parse(buffer.toString()));
        const actualCPreload = await TestUtil.getResourceByName(resources, "component-preload.js").then(buffer => buffer.toString());
        expect(actualManifest).to.eql(JSON.parse(TestUtil.getResource("manifest-expected.json")));
        expect(actualCPreload).to.eql(TestUtil.getResource("component-preload-expected.js"));
    });

    it("should skip base app files", async () => {
        const baseAppFiles = new Map([
            ["/manifest.json", TestUtil.getResource("manifest.json")],
            ["/manifest-bundle.zip", ""],
            ["/Component-preload.js", ""],
            ["/sap-ui-cachebuster-info.json", ""]
        ]);
        const resources = await BaseAppManager.process(baseAppFiles, appVariantInfo, options);
        expect(resources.map(res => res.getPath())).to.have.members(["/resources/ns/manifest.json"]);
    });

    it("should validate sap.app/id", async () => {
        await assertValidation(appVariantInfo, options, "Original application manifest should have sap.app/id", {});
    });

    it("should validate sap.app/applicationVersion/version", async () => {
        await assertValidation(appVariantInfo, options, "Original application manifest should have sap.app/applicationVersion/version", {
            "sap.app": { id: "id" }
        });
    });

    it("should delete 'sap.cloud' if sapCloudService is not presented in config", async () => {
        const baseAppFiles = new Map([["/manifest.json", TestUtil.getResource("manifest.json")]]);
        const optionsClone = { ...options, configuration: { ...options.configuration } };
        delete optionsClone.configuration["sapCloudService"];
        const resources = await BaseAppManager.process(baseAppFiles, appVariantInfo, optionsClone);
        const actual = await resources[0].getBuffer().then((buffer: Buffer) => JSON.parse(buffer.toString()));
        expect(actual["sap.cloud"]).to.be.undefined;
    });

    it("should create default 'sap.cloud'", async () => {
        const baseAppManifest = JSON.parse(TestUtil.getResource("manifest.json"));
        delete baseAppManifest["sap.cloud"];
        const baseAppFiles = new Map([["/manifest.json", JSON.stringify(baseAppManifest)]]);
        const resources = await BaseAppManager.process(baseAppFiles, appVariantInfo, options);
        const actual = await resources[0].getBuffer().then((buffer: Buffer) => JSON.parse(buffer.toString()));
        expect(actual["sap.cloud"]).to.eql({ service: "sapCloudService" });
    });
});

const assertValidation = async (appVariantInfo: IAppVariantInfo, options: IProjectOptions, expectedError: string, manifest: any) => {
    try {
        await BaseAppManager.process(new Map([["/manifest.json", JSON.stringify(manifest)]]), appVariantInfo, options);
        assert.fail(true, false, "Exception not thrown");
    } catch (error) {
        expect(error.message).to.equal(expectedError);
    }
}