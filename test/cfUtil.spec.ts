import * as _ from "lodash";
import * as chai from "chai";
import * as sinon from "sinon";

import CFUtil from "../src/util/cfUtil.js";
import { Cli } from "@sap/cf-tools/out/src/cli.js";
import { IGetServiceInstanceParams } from "../src/model/types.js";
import { SinonSandbox } from "sinon";
import TestUtil from "./testUtilities/testUtil.js";
import { eFilters } from "@sap/cf-tools/out/src/types.js";
import esmock from "esmock";

const { assert, expect } = chai;

describe("CFUtil", () => {
    let sandbox: SinonSandbox;

    beforeEach(() => sandbox = sinon.createSandbox());
    afterEach(() => sandbox.restore());

    describe("when execute a cf request", () => {

        it("should take resources multiple pages request with parameter", async () => {
            const CFUtil = await esmock("../src/util/cfUtil.js", {}, {
                "@sap/cf-tools/out/src/cli.js": {
                    Cli: {
                        execute: (args: string[]) => {
                            if (args[1] === "/v3/service_instances?per_page=200") {
                                return TestUtil.getStdOut({
                                    "pagination": {
                                        "total_results": 585,
                                        "total_pages": 3,
                                        "first": { "href": "https://api.cf.sap.hana.ondemand.com/v3/service_instances?page=1&per_page=200" },
                                        "last": { "href": "https://api.cf.sap.hana.ondemand.com/v3/service_instances?page=3&per_page=200" },
                                        "next": { "href": "https://api.cf.sap.hana.ondemand.com/v3/service_instances?page=2&per_page=200" },
                                        "previous": null
                                    },
                                    "resources": [{ "name": "service-page-1" }]
                                });
                            } else if (args[1] === "/v3/service_instances?per_page=200&page=2") {
                                return TestUtil.getStdOut({
                                    "pagination": {
                                        "total_results": 585,
                                        "total_pages": 3,
                                        "first": { "href": "https://api.cf.sap.hana.ondemand.com/v3/service_instances?page=1&per_page=200" },
                                        "last": { "href": "https://api.cf.sap.hana.ondemand.com/v3/service_instances?page=3&per_page=200" },
                                        "next": { "href": "https://api.cf.sap.hana.ondemand.com/v3/service_instances?page=3&per_page=200" },
                                        "previous": { "href": "https://api.cf.sap.hana.ondemand.com/v3/service_instances?page=1&per_page=200" }
                                    },
                                    "resources": [{ "name": "service-page-2" }]
                                });
                            } else if (args[1] === "/v3/service_instances?per_page=200&page=3") {
                                return TestUtil.getStdOut({
                                    "pagination": {
                                        "total_results": 585,
                                        "total_pages": 3,
                                        "first": { "href": "https://api.cf.sap.hana.ondemand.com/v3/service_instances?page=1&per_page=200" },
                                        "last": { "href": "https://api.cf.sap.hana.ondemand.com/v3/service_instances?page=3&per_page=200" },
                                        "next": null,
                                        "previous": { "href": "https://api.cf.sap.hana.ondemand.com/v3/service_instances?page=2&per_page=200" }
                                    },
                                    "resources": [{ "name": "service-page-3" }]
                                });
                            }
                        }
                    }
                }
            });
            const resources = await CFUtil.requestCfApi("/v3/service_instances?per_page=200");
            expect(resources).to.have.deep.members([{ "name": "service-page-1" }, { "name": "service-page-2" }, { "name": "service-page-3" }]);
        });

        it("should take resources multiple pages request without parameter", async () => {
            const CFUtil = await esmock("../src/util/cfUtil.js", {}, {
                "@sap/cf-tools/out/src/cli.js": {
                    Cli: {
                        execute: (args: string[]) => {
                            if (args[1] === "/v3/service_instances") {
                                return TestUtil.getStdOut({
                                    "pagination": {
                                        "total_results": 585,
                                        "total_pages": 2,
                                        "first": { "href": "https://api.cf.sap.hana.ondemand.com/v3/service_instances?page=1" },
                                        "last": { "href": "https://api.cf.sap.hana.ondemand.com/v3/service_instances?page=3" },
                                        "next": { "href": "https://api.cf.sap.hana.ondemand.com/v3/service_instances?page=2" },
                                        "previous": null
                                    },
                                    "resources": [{ "name": "service-page-1" }]
                                });
                            } else if (args[1] === "/v3/service_instances?page=2") {
                                return TestUtil.getStdOut({
                                    "pagination": {
                                        "total_results": 585,
                                        "total_pages": 2,
                                        "first": { "href": "https://api.cf.sap.hana.ondemand.com/v3/service_instances?page=1" },
                                        "last": { "href": "https://api.cf.sap.hana.ondemand.com/v3/service_instances?page=2" },
                                        "next": null,
                                        "previous": { "href": "https://api.cf.sap.hana.ondemand.com/v3/service_instances?page=1" }
                                    },
                                    "resources": [{ "name": "service-page-2" }]
                                });
                            }
                        }
                    }
                }
            });
            const resources = await CFUtil.requestCfApi("/v3/service_instances");
            expect(resources).to.have.deep.members([{ "name": "service-page-1" }, { "name": "service-page-2" }]);
        });

        it("should take resources from 1 page", async () => {
            const CFUtil = await esmock("../src/util/cfUtil.js", {}, {
                "@sap/cf-tools/out/src/cli.js": {
                    Cli: {
                        execute: (args: string[]) => {
                            if (args[1] === "/v3/service_instances?per_page=200") {
                                return TestUtil.getStdOut({
                                    "pagination": {
                                        "total_results": 585,
                                        "total_pages": 1,
                                        "first": { "href": "https://api.cf.sap.hana.ondemand.com/v3/service_instances?page=1&per_page=600" },
                                        "last": { "href": "https://api.cf.sap.hana.ondemand.com/v3/service_instances?page=1&per_page=600" },
                                        "next": null,
                                        "previous": null
                                    },
                                    "resources": [{ "name": "service-page-1" }]
                                });
                            }
                        }
                    }
                }
            });
            const resources = await CFUtil.requestCfApi("/v3/service_instances?per_page=200");
            expect(resources).to.have.deep.members([{ "name": "service-page-1" }]);
        });

        it("should take throw exception on first page", async () => {
            const CFUtil = await esmock("../src/util/cfUtil.js", {}, {
                "@sap/cf-tools/out/src/cli.js": {
                    Cli: {
                        execute: (args: string[]) => {
                            if (args[1] === "/v3/service_instances?per_page=200") {
                                return TestUtil.getStdOut({}, 1, "Error from 1 page");
                            } else if (args[1] === "/v3/service_instances?per_page=200&page=2") {
                                return TestUtil.getStdOut({}, 1, "Error from 2 page");
                            }
                        }
                    }
                }
            });
            try {
                await CFUtil.requestCfApi("/v3/service_instances?per_page=200");
                assert.fail(true, false, "Exception not thrown");
            } catch (error: any) {
                expect(error.message).to.equal(`Failed to send request with parameters '["curl","/v3/service_instances?per_page=200"]': Error from 1 page`);
            }
        });

        it("should throw exception on second page", async () => {
            let call = 0;
            const CFUtil = await esmock("../src/util/cfUtil.js", {}, {
                "@sap/cf-tools/out/src/cli.js": {
                    Cli: {
                        execute: (args: string[]) => {
                            if (args[1] === "/v3/service_instances?per_page=200") {
                                return TestUtil.getStdOut({
                                    "pagination": {
                                        "total_results": 585,
                                        "total_pages": 3,
                                        "first": { "href": "https://api.cf.sap.hana.ondemand.com/v3/service_instances?page=1&per_page=200" },
                                        "last": { "href": "https://api.cf.sap.hana.ondemand.com/v3/service_instances?page=3&per_page=200" },
                                        "next": { "href": "https://api.cf.sap.hana.ondemand.com/v3/service_instances?page=2&per_page=200" },
                                        "previous": null
                                    },
                                    "resources": [{ "name": "service-page-1" }]
                                });
                            } else if (args[1] === "/v3/service_instances?per_page=200&page=2") {
                                if (call === 0) {
                                    call++;
                                    return TestUtil.getStdOut({}, 1, "Error from 2 page 1 call");
                                } else if (call === 1) {
                                    call++;
                                    return TestUtil.getStdOut({}, 1, "Error from 2 page 2 call");
                                } else if (call === 2) {
                                    call++;
                                    return TestUtil.getStdOut({}, 1, "Error from 2 page 3 call");
                                }
                            } else if (args[1] === "/v3/service_instances?per_page=200&page=3") {
                                return TestUtil.getStdOut({}, 1, "Error from 3 page");
                            }
                        }
                    }
                }
            });
            try {
                await CFUtil.requestCfApi("/v3/service_instances?per_page=200");
                assert.fail(true, false, "Exception not thrown");
            } catch (error: any) {
                expect(error.message).to.equal(`Failed to send request with parameters '["curl","/v3/service_instances?per_page=200&page=2"]': 1 attempt: Error from 2 page 1 call; 2 attempt: Error from 2 page 2 call; 3 attempt: Error from 2 page 3 call`);
            }
        });
    });

    describe("when getting service keys", () => {

        it("should succesfully create and return service keys and serviceInstance info", async () => {
            const credentialsJson = JSON.parse(TestUtil.getResource("credentials_bs.json"));
            let call = 0;
            const CFUtil = await esmock("../src/util/cfUtil.js", {}, {
                "@sap/cf-tools/out/src/cli.js": {
                    Cli: {
                        execute: (args: string[]) => {
                            if (args[1] === "/v3/service_instances?space_guids=spaceGuid1&names=serviceInstance1") {
                                return TestUtil.getStdOut(TestUtil.getResource("service_instances_bs.json"));
                            } else if (args[0] === "create-service-key" && args[1] === "serviceInstance1" && args[2] === "serviceInstance1_key") {
                                return TestUtil.getStdOut("");
                            } else if (args[1] === "/v3/service_instances?per_page=200&page=3") {
                                return TestUtil.getStdOut({}, 1, "Error from 3 page");
                            }
                        }
                    }
                },
                "@sap/cf-tools/out/src/cf-local.js": {
                    cfGetInstanceCredentials: () => {
                        if (call === 0) {
                            call++;
                            return Promise.resolve([]);
                        } else {
                            return Promise.resolve(credentialsJson);
                        }
                    }
                }
            });
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
            const CFUtil = await esmock("../src/util/cfUtil.js", {}, {
                "@sap/cf-tools/out/src/cli.js": {
                    Cli: {
                        execute: (args: string[]) => {
                            if (args[1] === "/v3/service_instances?space_guids=spaceGuid1&names=serviceInstance1") {
                                return TestUtil.getStdOut(TestUtil.getResource("service_instances_bs.json"));
                            } else if (args[0] === "create-service-key" && args[1] === "serviceInstance1" && args[2] === "serviceInstance1_key") {
                                return TestUtil.getStdOut("");
                            } else if (args[1] === "/v3/service_instances?per_page=200&page=3") {
                                return TestUtil.getStdOut({}, 1, "Error from 3 page");
                            }
                        }
                    }
                },
                "@sap/cf-tools/out/src/cf-local.js": {
                    cfGetInstanceCredentials: () => Promise.resolve([])
                }
            });
            try {
                await CFUtil.getServiceInstanceKeys({
                    spaceGuids: ["spaceGuid1"],
                    names: ["serviceInstance1"]
                });
                assert.fail(true, false, "Exception not thrown");
            } catch (error: any) {
                expect(error.message).to.equal("Cannot get service keys for 'serviceInstance1' service in current space: spaceGuid1");
            }
        });

        it("should throw exception if service instance not found", async () => {
            const CFUtil = await esmock("../src/util/cfUtil.js", {}, {
                "@sap/cf-tools/out/src/cli.js": {
                    Cli: {
                        execute: (args: string[]) => {
                            if (args[1] === "/v3/service_instances?space_guids=spaceGuid1&names=serviceInstance1") {
                                return TestUtil.getStdOut(TestUtil.getResource("service_instances_empty_bs.json"));
                            }
                        }
                    }
                }
            });
            try {
                await CFUtil.getServiceInstanceKeys({
                    spaceGuids: ["spaceGuid1"],
                    names: ["serviceInstance1"]
                });
                assert.fail(true, false, "Exception not thrown");
            } catch (error: any) {
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
        const SERVICE = "service1";
        const SERVICE_INSTANCE = "serviceInstance1";
        const PLAN = "app-runtime";

        it("should create a service", async () => {
            await createService(TestUtil.getResource("service_offerings.json"), TestUtil.getResource("service_plans.json"));
        });

        it("shouldn't find a plan by name", async () => {
            await expect(createService(TestUtil.getResource("service_offerings.json"), JSON.stringify({ resources: [{ name: "app-something" }] })))
                .to.be.rejectedWith("Cannot find a plan by name 'app-runtime' for service 'service1'");
        });

        it("ahouldn't find service offering", async () => {
            await expect(createService(JSON.stringify({ resources: [] }), TestUtil.getResource("service_plans.json")))
                .to.be.rejectedWith("Cannot find a service offering by name 'service1'");
        });

        async function createService(serviceOfferings: string, plans: string) {
            let call = 0;
            const credentialsJson = JSON.parse(TestUtil.getResource("credentials_bs.json"));
            const CFUtil = await esmock("../src/util/cfUtil.js", {}, {
                "@sap/cf-tools/out/src/cli.js": {
                    Cli: {
                        execute: (args: string[]) => {
                            if (args[1] === `/v3/service_instances?space_guids=${SPACE_GUID}&names=${NON_EXISTING_SERVICE_INSTANCE}`) {
                                if (call === 0) {
                                    call++;
                                    return TestUtil.getStdOut(TestUtil.getResource("service_instances_empty_bs.json"));
                                } else {
                                    return TestUtil.getStdOut(TestUtil.getResource("service_instances_bs.json"));
                                }
                            } else if (args[1] === `/v3/service_offerings?names=${SERVICE}`) {
                                return TestUtil.getStdOut(serviceOfferings);
                            } else if (args[1] === `/v3/service_plans?service_offering_guids=B8F4D0AC-9F30-4C18-B808-D8C1C6E2646E`) {
                                return TestUtil.getStdOut(plans);
                            }
                        }
                    }
                },
                "@sap/cf-tools/out/src/cf-local.js": {
                    cfCreateService: () => Promise.resolve(),
                    cfGetInstanceCredentials: (args: any) => {
                        if (JSON.stringify(args) === JSON.stringify({
                            filters: [{
                                value: "serviceInstance1Guid",
                                key: eFilters.service_instance_guids
                            }]
                        })) {
                            return Promise.resolve(credentialsJson);
                        } else {
                            return Promise.resolve([]);
                        }
                    }
                }
            });
            const result = await CFUtil.getServiceInstanceKeys({
                spaceGuids: [SPACE_GUID],
                names: [NON_EXISTING_SERVICE_INSTANCE]
            }, {
                serviceName: SERVICE,
                serviceInstanceName: SERVICE_INSTANCE,
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
        }

    });

    describe("when getting space", () => {
        it("should get space from cf if not specified in options", async () => {
            const CFUtil = await esmock("../src/util/cfUtil.js", {}, {
                "@sap/cf-tools/out/src/utils.js": {
                    getSpaceGuidThrowIfUndefined: () => Promise.resolve("spaceGuid1")
                }
            });
            expect(await CFUtil.getSpaceGuid()).to.equal("spaceGuid1");
        });

        it("should return space guid specified in options", async () => {
            expect(await CFUtil.getSpaceGuid("spaceGuid2")).to.equal("spaceGuid2");
        });
    });

});

const spyCFToolsCliCliExecute = async (sandbox: SinonSandbox, params: IGetServiceInstanceParams, expected: string) => {
    const stub = sandbox.stub(Cli, "execute");
    stub.callsFake(() => TestUtil.getStdOut(TestUtil.getResource("service_instances_empty_bs.json")));
    try {
        await CFUtil.getServiceInstanceKeys(params);
    } catch (error: any) {
        expect(error.message).to.equal(`Cannot find '${params.names?.join(", ")}' service in current space: ${params.spaceGuids?.join(", ")}`);
    }
    expect(stub.getCall(0).args[0]).to.eql(["curl", expected]);
}