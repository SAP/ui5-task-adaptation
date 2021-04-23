import * as chai from "chai";
import * as sinon from "sinon";

import CFUtil from "../src/util/cfUtil";
import { IGetServiceInstanceParams } from "../src/model/types";
import { SinonSandbox } from "sinon";
import TestUtil from "./util/testUtil";
import { eFilters } from "@sap/cf-tools/out/src/types";

import CFToolsCli = require("@sap/cf-tools/out/src/cli");
import CFLocal = require("@sap/cf-tools/out/src/cf-local");
const { assert, expect } = chai;

describe("CFUtil", () => {
    let sandbox: SinonSandbox;

    beforeEach(() => sandbox = sinon.createSandbox());
    afterEach(() => sandbox.restore());

    describe("when execute a cf request", () => {

        it("should take resources multiple pages request with parameter", async () => {
            sandbox.stub(CFToolsCli.Cli, "execute")
                .withArgs(["curl", "/v3/service_instances?per_page=200"], TestUtil.ENV)
                .callsFake(() => TestUtil.getStdOut({
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
                .withArgs(["curl", "/v3/service_instances?per_page=200&page=2"], TestUtil.ENV)
                .callsFake(() => TestUtil.getStdOut({
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
                .withArgs(["curl", "/v3/service_instances?per_page=200&page=3"], TestUtil.ENV)
                .callsFake(() => TestUtil.getStdOut({
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
                .withArgs(["curl", "/v3/service_instances"], TestUtil.ENV)
                .callsFake(() => TestUtil.getStdOut({
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
                .withArgs(["curl", "/v3/service_instances?page=2"], TestUtil.ENV)
                .callsFake(() => TestUtil.getStdOut({
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
                .withArgs(["curl", "/v3/service_instances?per_page=200"], TestUtil.ENV)
                .callsFake(() => TestUtil.getStdOut({
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
                .withArgs(["curl", "/v3/service_instances?per_page=200"], TestUtil.ENV)
                .callsFake(() => TestUtil.getStdOut({}, 1, "Error from 1 page"))
                .withArgs(["curl", "/v3/service_instances?per_page=200&page=2"], TestUtil.ENV)
                .callsFake(() => TestUtil.getStdOut({}, 1, "Error from 2 page"));
            try {
                await CFUtil.requestCfApi("/v3/service_instances?per_page=200");
                assert.fail(true, false, "Exception not thrown");
            } catch (error) {
                expect(error.message).to.equal(`Failed to send request with parameters '["curl","/v3/service_instances?per_page=200"]': Error from 1 page`);
            }
        });

        it("should throw exception on second page", async () => {
            sandbox.stub(CFToolsCli.Cli, "execute")
                .withArgs(["curl", "/v3/service_instances?per_page=200"], TestUtil.ENV)
                .callsFake(() => TestUtil.getStdOut({
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
                .withArgs(["curl", "/v3/service_instances?per_page=200&page=2"], TestUtil.ENV)
                .onFirstCall().callsFake(() => TestUtil.getStdOut({}, 1, "Error from 2 page 1 call"))
                .onSecondCall().callsFake(() => TestUtil.getStdOut({}, 1, "Error from 2 page 2 call"))
                .onThirdCall().callsFake(() => TestUtil.getStdOut({}, 1, "Error from 2 page 3 call"))
                .withArgs(["curl", "/v3/service_instances?per_page=200&page=3"], TestUtil.ENV)
                .callsFake(() => TestUtil.getStdOut({}, 1, "Error from 3 page"));;
            try {
                await CFUtil.requestCfApi("/v3/service_instances?per_page=200");
                assert.fail(true, false, "Exception not thrown");
            } catch (error) {
                expect(error.message).to.equal(`Failed to send request with parameters '["curl","/v3/service_instances?per_page=200&page=2"]': 1 attempt: Error from 2 page 1 call; 2 attempt: Error from 2 page 2 call; 3 attempt: Error from 2 page 3 call`);
            }
        });
    });

    describe("when getting service keys", () => {

        it("should succesfully create and return service keys and serviceInstance info", async () => {
            const credentialsJson = JSON.parse(TestUtil.getResource("credentials_bs.json"));
            sandbox.stub(CFToolsCli.Cli, "execute")
                .withArgs(["curl", "/v3/service_instances?space_guids=spaceGuid1&names=serviceInstance1"], TestUtil.ENV)
                .callsFake(() => TestUtil.getStdOut(TestUtil.getResource("service_instances_bs.json")))
                .withArgs(["create-service-key", "serviceInstance1", "serviceInstance1_key"], TestUtil.ENV)
                .callsFake(() => TestUtil.getStdOut(""));
            sandbox.stub(CFLocal, "cfGetInstanceCredentials")
                .withArgs({
                    filters: [{
                        value: "serviceInstance1Guid",
                        key: eFilters.service_instance_guids
                    }]
                })
                .onFirstCall().callsFake(() => Promise.resolve([]))
                .onSecondCall().callsFake(() => Promise.resolve(credentialsJson));
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

        it("should throw an exception when after creating service keys are not found", async () => {
            sandbox.stub(CFToolsCli.Cli, "execute")
                .withArgs(["curl", "/v3/service_instances?space_guids=spaceGuid1&names=serviceInstance1"], TestUtil.ENV)
                .callsFake(() => TestUtil.getStdOut(TestUtil.getResource("service_instances_bs.json")))
                .withArgs(["create-service-key", "serviceInstance1", "serviceInstance1_key"], TestUtil.ENV)
                .callsFake(() => TestUtil.getStdOut(""));
            sandbox.stub(CFLocal, "cfGetInstanceCredentials")
                .withArgs({
                    filters: [{
                        value: "serviceInstance1Guid",
                        key: eFilters.service_instance_guids
                    }]
                })
                .onFirstCall().callsFake(() => Promise.resolve([]))
                .onSecondCall().callsFake(() => Promise.resolve([]));
            try {
                await CFUtil.getServiceInstanceKeys({
                    spaceGuids: ["spaceGuid1"],
                    names: ["serviceInstance1"]
                });
                assert.fail(true, false, "Exception not thrown");
            } catch (error) {
                expect(error.message).to.equal("Cannot get service keys for 'serviceInstance1' service in current space: spaceGuid1");
            }
        });

        it("should throw exception if service instance not found", async () => {
            sandbox.stub(CFToolsCli.Cli, "execute")
                .withArgs(["curl", "/v3/service_instances?space_guids=spaceGuid1&names=serviceInstance1"], TestUtil.ENV)
                .callsFake(() => TestUtil.getStdOut(TestUtil.getResource("service_instances_empty_bs.json")));
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

    describe("when creating service", () => {
        const SPACE_GUID = "spaceGuid1";
        const NON_EXISTING_SERVICE_INSTANCE = "nonExistingServiceInstance";
        const SERVICE_INSTANCE = "serviceInstance1";
        const PLAN = "serviceInstancePlan";

        it("should create a service with parameters", async () => {
            const credentialsJson = JSON.parse(TestUtil.getResource("credentials_bs.json"));
            sandbox.stub(CFToolsCli.Cli, "execute")
                .withArgs(["curl", `/v3/service_instances?space_guids=${SPACE_GUID}&names=${NON_EXISTING_SERVICE_INSTANCE}`], TestUtil.ENV)
                .onFirstCall().callsFake(() => TestUtil.getStdOut(TestUtil.getResource("service_instances_empty_bs.json")))
                .onSecondCall().callsFake(() => TestUtil.getStdOut(TestUtil.getResource("service_instances_bs.json")))
                .withArgs(["curl", `/v3/service_plans?names=${PLAN}&space_guids=${SPACE_GUID}`], TestUtil.ENV)
                .callsFake(() => TestUtil.getStdOut(TestUtil.getResource("service_plans.json")));
            sandbox.stub(CFLocal, "cfCreateService");
            sandbox.stub(CFLocal, "cfGetInstanceCredentials")
                .withArgs({
                    filters: [{
                        value: "serviceInstance1Guid",
                        key: eFilters.service_instance_guids
                    }]
                })
                .callsFake(() => Promise.resolve(credentialsJson));
            const result = await CFUtil.getServiceInstanceKeys({
                spaceGuids: [SPACE_GUID],
                names: [NON_EXISTING_SERVICE_INSTANCE]
            }, {
                serviceName: SERVICE_INSTANCE,
                planName: PLAN,
                spaceGuid: SPACE_GUID,
                tags: ["tag1"]
            });
            expect(result).to.eql({
                credentials: credentialsJson[0].credentials,
                serviceInstance: {
                    guid: "serviceInstance1Guid",
                    name: "serviceInstance1"
                }
            });
        });

    });

    describe("when getting space", () => {
        it("should get space from cf if not specified in options", async () => {
            const SPACE_NAME = "spaceName1"
            sandbox.stub(CFLocal, "cfGetTarget")
                .callsFake(() => Promise.resolve({ space: SPACE_NAME, "api endpoint": "apiEndpoint", "api version": "apiVersion", user: "user" }));
            sandbox.stub(CFToolsCli.Cli, "execute")
                .withArgs(["curl", `/v3/spaces?names=${SPACE_NAME}`], TestUtil.ENV)
                .callsFake(() => TestUtil.getStdOut(TestUtil.getResource("spaces.json")));
            const spaceGuid = await CFUtil.getSpaceGuid();
            expect(spaceGuid).to.equal("spaceGuid1");
        });

        it("should return space guid specified in options", async () => {
            expect(await CFUtil.getSpaceGuid("spaceGuid1")).to.equal("spaceGuid1");
        });
    });

});

const spyCFToolsCliCliExecute = async (sandbox: SinonSandbox, params: IGetServiceInstanceParams, expected: string) => {
    const stub = sandbox.stub(CFToolsCli.Cli, "execute");
    stub.callsFake(() => TestUtil.getStdOut(TestUtil.getResource("service_instances_empty_bs.json")));
    try {
        await CFUtil.getServiceInstanceKeys(params);
    } catch (error) {
        expect(error.message).to.equal(`Cannot find '${params.names?.join(", ")}' service in current space: ${params.spaceGuids?.join(", ")}`);
    }
    expect(stub.getCall(0).args[0]).to.eql(["curl", expected]);
}