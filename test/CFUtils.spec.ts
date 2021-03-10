import { SinonSandbox } from "sinon";
import * as sinon from "sinon";
import CFToolsCli = require("@sap/cf-tools/out/src/cli");
import CFLocal = require("@sap/cf-tools/out/src/cf-local");
import CFUtil from "../src/util/cfUtil";
const ENV = { env: { "CF_COLOR": "false" } };
import * as chai from "chai";
import TestUtil from "./util/testUtil";
import { eFilters } from "@sap/cf-tools/out/src/types";
import { IGetServiceInstanceParams } from "../src/model/types";
const { assert, expect } = chai;

describe("CFUtil", () => {
    let sandbox: SinonSandbox;

    beforeEach(() => sandbox = sinon.createSandbox());
    afterEach(() => sandbox.restore());

    describe("when execute a cf request", () => {

        it("should take resources multiple pages request with parameter", async () => {
            sandbox.stub(CFToolsCli.Cli, "execute")
                .withArgs(["curl", "/v3/service_instances?per_page=200"], ENV)
                .callsFake(() => getStdOut({
                    "pagination": {
                        "total_results": 585,
                        "total_pages": 3,
                        "first": { "href": "https://api.cf.sap.hana.ondemand.com/v3/service_instances?page=1&per_page=200" },
                        "last": { "href": "https://api.cf.sap.hana.ondemand.com/v3/service_instances?page=3&per_page=200" },
                        "next": { "href": "https://api.cf.sap.hana.ondemand.com/v3/service_instances?page=2&per_page=200" },
                        "previous": null
                    },
                    "resources": [{ "name": "service-page-1" }]
                }))
                .withArgs(["curl", "/v3/service_instances?per_page=200&page=2"], ENV)
                .callsFake(() => getStdOut({
                    "pagination": {
                        "total_results": 585,
                        "total_pages": 3,
                        "first": { "href": "https://api.cf.sap.hana.ondemand.com/v3/service_instances?page=1&per_page=200" },
                        "last": { "href": "https://api.cf.sap.hana.ondemand.com/v3/service_instances?page=3&per_page=200" },
                        "next": { "href": "https://api.cf.sap.hana.ondemand.com/v3/service_instances?page=3&per_page=200" },
                        "previous": { "href": "https://api.cf.sap.hana.ondemand.com/v3/service_instances?page=1&per_page=200" }
                    },
                    "resources": [{ "name": "service-page-2" }]
                }))
                .withArgs(["curl", "/v3/service_instances?per_page=200&page=3"], ENV)
                .callsFake(() => getStdOut({
                    "pagination": {
                        "total_results": 585,
                        "total_pages": 3,
                        "first": { "href": "https://api.cf.sap.hana.ondemand.com/v3/service_instances?page=1&per_page=200" },
                        "last": { "href": "https://api.cf.sap.hana.ondemand.com/v3/service_instances?page=3&per_page=200" },
                        "next": null,
                        "previous": { "href": "https://api.cf.sap.hana.ondemand.com/v3/service_instances?page=2&per_page=200" }
                    },
                    "resources": [{ "name": "service-page-3" }]
                }));
            const resources = await CFUtil.requestCfApi("/v3/service_instances?per_page=200");
            expect(resources).to.have.deep.members([{ "name": "service-page-1" }, { "name": "service-page-2" }, { "name": "service-page-3" }]);
        });

        it("should take resources multiple pages request without parameter", async () => {
            sandbox.stub(CFToolsCli.Cli, "execute")
                .withArgs(["curl", "/v3/service_instances"], ENV)
                .callsFake(() => getStdOut({
                    "pagination": {
                        "total_results": 585,
                        "total_pages": 2,
                        "first": { "href": "https://api.cf.sap.hana.ondemand.com/v3/service_instances?page=1" },
                        "last": { "href": "https://api.cf.sap.hana.ondemand.com/v3/service_instances?page=3" },
                        "next": { "href": "https://api.cf.sap.hana.ondemand.com/v3/service_instances?page=2" },
                        "previous": null
                    },
                    "resources": [{ "name": "service-page-1" }]
                }))
                .withArgs(["curl", "/v3/service_instances?page=2"], ENV)
                .callsFake(() => getStdOut({
                    "pagination": {
                        "total_results": 585,
                        "total_pages": 2,
                        "first": { "href": "https://api.cf.sap.hana.ondemand.com/v3/service_instances?page=1" },
                        "last": { "href": "https://api.cf.sap.hana.ondemand.com/v3/service_instances?page=2" },
                        "next": null,
                        "previous": { "href": "https://api.cf.sap.hana.ondemand.com/v3/service_instances?page=1" }
                    },
                    "resources": [{ "name": "service-page-2" }]
                }));
            const resources = await CFUtil.requestCfApi("/v3/service_instances");
            expect(resources).to.have.deep.members([{ "name": "service-page-1" }, { "name": "service-page-2" }]);
        });

        it("should take resources from 1 page", async () => {
            sandbox.stub(CFToolsCli.Cli, "execute")
                .withArgs(["curl", "/v3/service_instances?per_page=200"], ENV)
                .callsFake(() => getStdOut({
                    "pagination": {
                        "total_results": 585,
                        "total_pages": 1,
                        "first": { "href": "https://api.cf.sap.hana.ondemand.com/v3/service_instances?page=1&per_page=600" },
                        "last": { "href": "https://api.cf.sap.hana.ondemand.com/v3/service_instances?page=1&per_page=600" },
                        "next": null,
                        "previous": null
                    },
                    "resources": [{ "name": "service-page-1" }]
                }));
            const resources = await CFUtil.requestCfApi("/v3/service_instances?per_page=200");
            expect(resources).to.have.deep.members([{ "name": "service-page-1" }]);
        });

        it("should take throw exception on first page", async () => {
            sandbox.stub(CFToolsCli.Cli, "execute")
                .withArgs(["curl", "/v3/service_instances?per_page=200"], ENV)
                .callsFake(() => getStdOut({}, 1, "Error from 1 page"))
                .withArgs(["curl", "/v3/service_instances?per_page=200&page=2"], ENV)
                .callsFake(() => getStdOut({}, 1, "Error from 2 page"));
            try {
                await CFUtil.requestCfApi("/v3/service_instances?per_page=200");
                assert.fail(true, false, "Exception not thrown");
            } catch (error) {
                expect(error.message).to.equal(`Failed to send request with parameters '["curl","/v3/service_instances?per_page=200"]': Error from 1 page`);
            }
        });

        it("should throw exception on second page", async () => {
            sandbox.stub(CFToolsCli.Cli, "execute")
                .withArgs(["curl", "/v3/service_instances?per_page=200"], ENV)
                .callsFake(() => getStdOut({
                    "pagination": {
                        "total_results": 585,
                        "total_pages": 3,
                        "first": { "href": "https://api.cf.sap.hana.ondemand.com/v3/service_instances?page=1&per_page=200" },
                        "last": { "href": "https://api.cf.sap.hana.ondemand.com/v3/service_instances?page=3&per_page=200" },
                        "next": { "href": "https://api.cf.sap.hana.ondemand.com/v3/service_instances?page=2&per_page=200" },
                        "previous": null
                    },
                    "resources": [{ "name": "service-page-1" }]
                }))
                .withArgs(["curl", "/v3/service_instances?per_page=200&page=2"], ENV)
                .onFirstCall().callsFake(() => getStdOut({}, 1, "Error from 2 page 1 call"))
                .onSecondCall().callsFake(() => getStdOut({}, 1, "Error from 2 page 2 call"))
                .onThirdCall().callsFake(() => getStdOut({}, 1, "Error from 2 page 3 call"))
                .withArgs(["curl", "/v3/service_instances?per_page=200&page=3"], ENV)
                .callsFake(() => getStdOut({}, 1, "Error from 3 page"));;
            try {
                await CFUtil.requestCfApi("/v3/service_instances?per_page=200");
                assert.fail(true, false, "Exception not thrown");
            } catch (error) {
                expect(error.message).to.equal(`Failed to send request with parameters '["curl","/v3/service_instances?per_page=200&page=2"]': 1 attempt: Error from 2 page 1 call; 2 attempt: Error from 2 page 2 call; 3 attempt: Error from 2 page 3 call`);
            }
        });
    });

    describe("when getting service keys", () => {
        it("should succesfully return service keys and serviceInstance info", async () => {
            const credentialsJson = JSON.parse(TestUtil.getResource("credentials_bs.json"));
            sandbox.stub(CFToolsCli.Cli, "execute")
                .withArgs(["curl", "/v3/service_instances?space_guids=spaceGuid1&names=serviceInstance1"], ENV)
                .callsFake(() => getStdOut(TestUtil.getResource("service_instances_bs.json")));
            sandbox.stub(CFLocal, "cfGetInstanceCredentials")
                .withArgs({
                    filters: [{
                        value: "serviceInstance1Guid",
                        key: eFilters.service_instance_guids
                    }]
                })
                .callsFake(() => credentialsJson);
            const result = await CFUtil.getServiceInstanceKeys({
                spaceGuids: ["spaceGuid1"],
                names: ["serviceInstance1"]
            });
            expect(result).to.eql({
                credentials: credentialsJson[0].credentials,
                serviceInstance: {
                    guid: "serviceInstance1Guid",
                    name: "serviceInstance1"
                }
            });
        });
        it("should throw exception if service instance not found", async () => {
            sandbox.stub(CFToolsCli.Cli, "execute")
                .withArgs(["curl", "/v3/service_instances?space_guids=spaceGuid1&names=serviceInstance1"], ENV)
                .callsFake(() => getStdOut(TestUtil.getResource("service_instances_empty_bs.json")));
            try {
                await CFUtil.getServiceInstanceKeys({
                    spaceGuids: ["spaceGuid1"],
                    names: ["serviceInstance1"]
                });
                assert.fail(true, false, "Exception not thrown");
            } catch (error) {
                expect(error.message).to.equal("Cannot find 'serviceInstance1' service in current space: spaceGuid1");
            }
        });
        it("should create uri with single parameters", async () => {
            await spyCFToolsCliCliExecute(sandbox, {
                spaceGuids: ["spaceGuid1"],
                names: ["serviceInstance1"],
                planNames: ["planName1"]
            }, "/v3/service_instances?space_guids=spaceGuid1&names=serviceInstance1&service_plan_names=planName1");
        });
        it("should create uri with array parameters", async () => {
            await spyCFToolsCliCliExecute(sandbox, {
                spaceGuids: ["spaceGuid1", "spaceGuid2"],
                names: ["serviceInstance1", "serviceInstance2"],
                planNames: ["planName1", "planName2"]
            }, "/v3/service_instances?space_guids=spaceGuid1,spaceGuid2&names=serviceInstance1,serviceInstance2&service_plan_names=planName1,planName2");
        });
        it("should create uri with empty parameters", async () => {
            await spyCFToolsCliCliExecute(sandbox, {
                spaceGuids: [],
                names: [],
                planNames: []
            }, "/v3/service_instances");
        });
    });

});

const spyCFToolsCliCliExecute = async (sandbox: SinonSandbox, params: IGetServiceInstanceParams, expected: string) => {
    const stunb = sandbox.stub(CFToolsCli.Cli, "execute");
    stunb.callsFake(() => getStdOut(TestUtil.getResource("service_instances_empty_bs.json")));
    try {
        await CFUtil.getServiceInstanceKeys(params);
    } catch (error) {
        expect(error.message).to.equal(`Cannot find '${params.names?.join(", ")}' service in current space: ${params.spaceGuids?.join(", ")}`);
    }
    expect(stunb.getCall(0).args[0]).to.eql(["curl", expected]);
}

const getStdOut = (stdout: any, exitCode: number = 0, stderr: string = "") => Promise.resolve({
    stdout: typeof stdout === "string" ? stdout : JSON.stringify(stdout),
    stderr,
    exitCode
});