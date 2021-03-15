/// <reference path="../types/index.d.ts"/>
import { SinonSandbox } from "sinon";
import * as sinon from "sinon";
import * as chai from "chai";
import TestUtil from "./util/testUtil";
import { IProjectOptions } from "../src/model/types";
import BaseAppManager from "../src/baseAppManager";
const { expect } = chai;

describe.skip("BaseAppManager", () => {
    let sandbox: SinonSandbox;

    beforeEach(async () => sandbox = sinon.createSandbox());
    afterEach(() => sandbox.restore());

    it("", async () => {
        const appVariantInfo = await TestUtil.getAppVariantInfo("appVariant1");
        const baseAppFiles = new Map([["manifest.json", "file"]]);
        const options: IProjectOptions = {
            projectNamespace: "ns",
            configuration: {
                appHostId: "appHostId",
                appId: "appId",
                appName: "appName",
                appVersion: "appVersion",
                spaceGuid: "spaceGuid",
                orgGuid: "orgGuid",
                html5RepoRuntimeGuid: "html5RepoRuntimeGuid",
                sapCloudService: "sapCloudService"
            }
        };
        const resources = await BaseAppManager.process(baseAppFiles, appVariantInfo, options);
        expect(resources).to.eql({});
    });
});