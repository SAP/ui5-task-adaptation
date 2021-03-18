/// <reference path="../types/index.d.ts"/>
import { SinonSandbox } from "sinon";
import * as sinon from "sinon";
import CFLocal = require("@sap/cf-tools/out/src/cf-local");
import { IProjectOptions } from "../src/model/types";
import Html5RepoManager from "../src/html5RepoManager";
import { expect, assert } from "chai";
import CFToolsCli = require("@sap/cf-tools/out/src/cli");
import TestUtil from "./util/testUtil";
import { eFilters } from "@sap/cf-tools";
import RequestUtil from "../src/util/requestUtil";

describe("Html5RepoManager", () => {
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
            html5RepoRuntimeGuid: "html5RepoRuntimeGuid",
            sapCloudService: "sapCloudService"
        }
    };

    beforeEach(async () => sandbox = sinon.createSandbox());
    afterEach(() => sandbox.restore());

    before(async () => {
    });

    it("should update base app manifest", async () => {
        sandbox.stub(CFToolsCli.Cli, "execute")
            .withArgs(["curl", "/v3/service_instances?space_guids=spaceGuid&service_plan_names=app-runtime&names=html5-apps-repo-runtime"], TestUtil.ENV)
            .callsFake(() => TestUtil.getStdOut(TestUtil.getResource("service_instances_repo.json")));
        const credentialsJson = JSON.parse(TestUtil.getResource("credentials_bs.json"));
        sandbox.stub(CFLocal, "cfGetInstanceCredentials")
            .withArgs({
                filters: [{
                    value: "html5RepoGuid1",
                    key: eFilters.service_instance_guids
                }]
            })
            .callsFake(() => Promise.resolve(credentialsJson));
        sandbox.stub(RequestUtil, "get")
            .callsFake(() => Promise.resolve({ "access_token": "accessToken1" }));
        sandbox.stub(RequestUtil, "download")
            .callsFake(() => Promise.resolve(TestUtil.getResourceBuffer("baseapp.zip")));
        const baseAppFiles = await Html5RepoManager.getBaseAppFiles(options.configuration);
        expect([...baseAppFiles.keys()]).to.have.members(["i18n.properties", "manifest.json"]);
    });

    it("should update base app manifest", async () => {
        sandbox.stub(CFToolsCli.Cli, "execute")
            .withArgs(["curl", "/v3/service_instances?space_guids=spaceGuid&service_plan_names=app-runtime&names=html5-apps-repo-runtime"], TestUtil.ENV)
            .callsFake(() => TestUtil.getStdOut(TestUtil.getResource("service_instances_repo.json")));
        const credentialsJson = JSON.parse(TestUtil.getResource("credentials_bs.json"));
        sandbox.stub(CFLocal, "cfGetInstanceCredentials")
            .withArgs({
                filters: [{
                    value: "html5RepoGuid1",
                    key: eFilters.service_instance_guids
                }]
            })
            .callsFake(() => Promise.resolve(credentialsJson));
        sandbox.stub(RequestUtil, "get")
            .callsFake(() => Promise.resolve({ "access_token": "accessToken1" }));
        sandbox.stub(RequestUtil, "download")
            .callsFake(() => Promise.resolve(TestUtil.getResourceBuffer("baseapp-corrupt.zip")));
        try {
            await Html5RepoManager.getBaseAppFiles(options.configuration)
            assert.fail(true, false, "Exception not thrown");
        } catch (error) {
            expect(error.message).to.equal("Failed to parse zip content from HTML5 Repository: Invalid CEN header (bad signature)");
        }
    });

});