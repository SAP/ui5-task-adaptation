import * as chai from "chai";
import * as sinon from "sinon";
import chaiAsPromised from "chai-as-promised";

import CFUtil from "../../src/util/cfUtil.js";
import { Cli } from "@sap/cf-tools/out/src/cli.js";
import { IGetServiceInstanceParams } from "../../src/model/types.js";
import { SinonSandbox } from "sinon";
import TestUtil from "./testUtilities/testUtil.js";
import { eFilters } from "@sap/cf-tools/out/src/types.js";
import esmock from "esmock";

chai.use(chaiAsPromised);
const { assert, expect } = chai;

describe("CFUtil", () => {
    let sandbox: SinonSandbox;

    beforeEach(() => sandbox = sinon.createSandbox());
    afterEach(() => sandbox.restore());

    // Helper function to create common CLI mocks for service key endpoint tests
    const createServiceKeyEndpointMocks = (options: {
        createKeyCallCount?: number;
        deleteKeyCallCount?: number;
        hasValidEndpoints?: boolean;
        serviceExists?: boolean;
        serviceInstanceName?: string;
        spaceGuid?: string;
    } = {}) => {
        const {
            createKeyCallCount = 0,
            deleteKeyCallCount = 0,
            hasValidEndpoints = true,
            serviceExists = true,
            serviceInstanceName = "test-service",
            spaceGuid = "test-space"
        } = options;

        let createCallCount = createKeyCallCount;
        let deleteCallCount = deleteKeyCallCount;

        const credentialsWithValidEndpoints = {
            credentials: {
                endpoints: {
                    "api-endpoint": {
                        url: "https://api.example.com",
                        destination: "api-dest"
                    }
                }
            }
        };

        const credentialsWithInvalidEndpoints = {
            credentials: {
                endpoints: "invalid-string-endpoint"  // endpoints as string instead of object
            }
        };

        return {
            "@sap/cf-tools/out/src/cli.js": {
                Cli: {
                    execute: (args: string[]) => {
                        if (args[1] === `/v3/service_instances?names=${serviceInstanceName}&space_guids=${spaceGuid}`) {
                            if (serviceExists) {
                                return TestUtil.getStdOut({
                                    "resources": [{ "name": serviceInstanceName, "guid": "test-guid" }]
                                });
                            } else {
                                return TestUtil.getStdOut({ "resources": [] });
                            }
                        } else if (args[1] === "/v3/service_credential_bindings?type=key&service_instance_guids=test-guid") {
                            if (createCallCount === 0) {
                                return TestUtil.getStdOut({ "resources": [] });
                            } else {
                                return TestUtil.getStdOut({ "resources": [{ "name": `${serviceInstanceName}-key-0` }] });
                            }
                        } else if (args[0] === "create-service-key" && args[1] === serviceInstanceName && args[2] === `${serviceInstanceName}-key-0`) {
                            createCallCount++;
                            return TestUtil.getStdOut("");
                        } else if (args[0] === "delete-service-key" && args[1] === serviceInstanceName && args[2] === `${serviceInstanceName}-key-0` && args[3] === "-f") {
                            deleteCallCount++;
                            return TestUtil.getStdOut("");
                        }
                    }
                }
            },
            "@sap/cf-tools/out/src/cf-local.js": {
                cfGetInstanceCredentials: () => {
                    if (createCallCount === 0) {
                        return Promise.resolve([]);
                    } else {
                        return Promise.resolve([hasValidEndpoints ? credentialsWithValidEndpoints : credentialsWithInvalidEndpoints]);
                    }
                }
            },
            "@sap/cf-tools/out/src/utils.js": {
                getSpaceGuidThrowIfUndefined: () => Promise.resolve(spaceGuid)
            },
            getCounters: () => ({ createCallCount, deleteCallCount }),
            getCredentials: () => hasValidEndpoints ? credentialsWithValidEndpoints : credentialsWithInvalidEndpoints
        };
    };

    // Helper function to create CLI mocks for service key name generation tests
    const createServiceKeyNameMocks = (serviceKeyNames: string[] = [], shouldError = false) => {
        return {
            "@sap/cf-tools/out/src/cli.js": {
                Cli: {
                    execute: (args: string[]) => {
                        if (args[1] === "/v3/service_credential_bindings?type=key&service_instance_guids=test-guid") {
                            if (shouldError) {
                                return TestUtil.getStdOut({}, 1, "CF API error");
                            }
                            const resources = serviceKeyNames.map(name => ({ name }));
                            return TestUtil.getStdOut({ "resources": resources });
                        }
                    }
                }
            }
        };
    };

    describe("when execute a cf request", () => {

        it("should take resources multiple pages request with parameter", async () => {
            const CFUtil = await esmock("../../src/util/cfUtil.js", {}, {
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
            const CFUtil = await esmock("../../src/util/cfUtil.js", {}, {
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
            const CFUtil = await esmock("../../src/util/cfUtil.js", {}, {
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
            const CFUtil = await esmock("../../src/util/cfUtil.js", {}, {
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
            const CFUtil = await esmock("../../src/util/cfUtil.js", {}, {
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

    it("should throw AuthenticationError when stdout is just newline", async () => {
        const CFUtilWithMock = await esmock("../../src/util/cfUtil.js", {
            "@sap/cf-tools/out/src/cli.js": {
                Cli: {
                    execute: () => ({ stdout: "\n", stderr: "", exitCode: 0 })
                }
            }
        });
        await expect(CFUtilWithMock.getOAuthToken()).to.be.rejectedWith("Authentication error. Use 'cf login' to authenticate in Cloud Foundry.");
    });

    describe("when getting service keys", () => {

        it("should succesfully create and return service keys and serviceInstance info", async () => {
            const credentialsJson = JSON.parse(TestUtil.getResource("credentials_bs.json"));
            let call = 0;
            const CFUtil = await esmock("../../src/util/cfUtil.js", {}, {
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
            const CFUtil = await esmock("../../src/util/cfUtil.js", {}, {
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
            const CFUtil = await esmock("../../src/util/cfUtil.js", {}, {
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
            const CFUtil = await esmock("../../src/util/cfUtil.js", {}, {
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
            const CFUtil = await esmock("../../src/util/cfUtil.js", {}, {
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


    describe("when sending CF request", () => {
        it("throws all errors if there is Authentication error", async () => {
            sandbox.stub(CFUtil, "cfExecute" as any).resolves(JSON.stringify({
                "errors": [{
                    "detail": "Authentication error",
                    "title": "CF-NotAuthenticated",
                    "code": 10002,
                }, {
                    "detail": "Other error",
                    "title": "CF-Other",
                    "code": 10001,
                }]
            }));
            await expect(CFUtil.requestCfApi("")).to.be.rejectedWith("Authentication error. Use 'cf login' to authenticate in Cloud Foundry: Authentication error");
        });
        it("throws errors if there are other errors", async () => {
            sandbox.stub(CFUtil, "cfExecute" as any).resolves(JSON.stringify({
                "errors": [{
                    "detail": "Other error",
                    "title": "CF-Other",
                    "code": 10001,
                }]
            }));
            await expect(CFUtil.requestCfApi("")).to.be.rejectedWith(`Failed sending request to Cloud Foundry: [{"detail":"Other error","title":"CF-Other","code":10001}]`);
        });
        it("returns empty resource list if no resources", async () => {
            sandbox.stub(CFUtil, "cfExecute" as any).resolves(JSON.stringify([]));
            expect(await CFUtil.requestCfApi("")).to.eql([]);
        });
        it("returns empty resource list if resources undefind", async () => {
            sandbox.stub(CFUtil, "cfExecute" as any).resolves(JSON.stringify({}));
            expect(await CFUtil.requestCfApi("")).to.eql([]);
        });
    });

    describe("when generating unique service key names", () => {

        it("should get all service key names for a service instance", async () => {
            const mocks = createServiceKeyNameMocks(["service-key-1", "service-key-2", "custom-key"]);
            const CFUtil = await esmock("../../src/util/cfUtil.js", {}, mocks);

            const keyNames = await CFUtil["getAllServiceKeyNames"]("test-guid");
            expect(keyNames).to.deep.equal(["service-key-1", "service-key-2", "custom-key"]);
        });

        it("should return empty array when no service keys exist", async () => {
            const mocks = createServiceKeyNameMocks([]);
            const CFUtil = await esmock("../../src/util/cfUtil.js", {}, mocks);

            const keyNames = await CFUtil["getAllServiceKeyNames"]("test-guid");
            expect(keyNames).to.deep.equal([]);
        });

        it("should generate unique service key name when no existing keys", async () => {
            const mocks = createServiceKeyNameMocks([]);
            const CFUtil = await esmock("../../src/util/cfUtil.js", {}, mocks);

            const uniqueName = await CFUtil.generateUniqueServiceKeyName("my-service", "test-guid");
            expect(uniqueName).to.equal("my-service-key-0");
        });

        it("should generate unique service key name avoiding existing names", async () => {
            const mocks = createServiceKeyNameMocks(["my-service-key-0", "my-service-key-1", "custom-key"]);
            const CFUtil = await esmock("../../src/util/cfUtil.js", {}, mocks);

            const uniqueName = await CFUtil.generateUniqueServiceKeyName("my-service", "test-guid");
            expect(uniqueName).to.equal("my-service-key-2");
        });

        it("should generate unique service key name with gaps in existing names", async () => {
            const mocks = createServiceKeyNameMocks(["my-service-key-0", "my-service-key-2", "other-key"]);
            const CFUtil = await esmock("../../src/util/cfUtil.js", {}, mocks);

            const uniqueName = await CFUtil.generateUniqueServiceKeyName("my-service", "test-guid");
            expect(uniqueName).to.equal("my-service-key-1");
        });

        it("should handle error when getting service key names", async () => {
            const mocks = createServiceKeyNameMocks([], true);
            const CFUtil = await esmock("../../src/util/cfUtil.js", {}, mocks);

            await expect(CFUtil["getAllServiceKeyNames"]("test-guid"))
                .to.be.rejectedWith("Failed to get service key names");
        });
    });

    describe("when getting or creating service keys with endpoints", () => {

        it("should use existing service key with valid endpoints", async () => {
            const mocks = createServiceKeyEndpointMocks();
            const credentials = mocks.getCredentials();

            const CFUtil = await esmock("../../src/util/cfUtil.js", {}, {
                "@sap/cf-tools/out/src/cli.js": mocks["@sap/cf-tools/out/src/cli.js"],
                "@sap/cf-tools/out/src/cf-local.js": {
                    cfGetInstanceCredentials: () => Promise.resolve([credentials])
                },
                "@sap/cf-tools/out/src/utils.js": mocks["@sap/cf-tools/out/src/utils.js"]
            });

            const result = await CFUtil.getOrCreateServiceKeyWithEndpoints("test-service", "test-space");
            expect(result).to.deep.equal(credentials.credentials);
        });

        it("should create new service key when no valid endpoints found", async () => {
            const mocks = createServiceKeyEndpointMocks();
            const credentials = mocks.getCredentials();

            const CFUtil = await esmock("../../src/util/cfUtil.js", {}, {
                "@sap/cf-tools/out/src/cli.js": mocks["@sap/cf-tools/out/src/cli.js"],
                "@sap/cf-tools/out/src/cf-local.js": mocks["@sap/cf-tools/out/src/cf-local.js"],
                "@sap/cf-tools/out/src/utils.js": mocks["@sap/cf-tools/out/src/utils.js"]
            });

            const result = await CFUtil.getOrCreateServiceKeyWithEndpoints("test-service");
            expect(result).to.deep.equal(credentials.credentials);
            expect(mocks.getCounters().createCallCount).to.equal(1);
        });

        it("should throw error if service instance not found", async () => {
            const mocks = createServiceKeyEndpointMocks({
                serviceExists: false,
                serviceInstanceName: "non-existent-service"
            });

            const CFUtil = await esmock("../../src/util/cfUtil.js", {}, {
                "@sap/cf-tools/out/src/cli.js": mocks["@sap/cf-tools/out/src/cli.js"],
                "@sap/cf-tools/out/src/utils.js": mocks["@sap/cf-tools/out/src/utils.js"]
            });

            try {
                await CFUtil.getOrCreateServiceKeyWithEndpoints("non-existent-service");
                assert.fail(true, false, "Exception not thrown");
            } catch (error: any) {
                expect(error.message).to.include("Cannot find service instance 'non-existent-service' in space: test-space");
            }
        });

        it("shouldn't throw error if created service key does not have valid endpoints", async () => {
            const mocks = createServiceKeyEndpointMocks({ hasValidEndpoints: false });

            const CFUtil = await esmock("../../src/util/cfUtil.js", {}, {
                "@sap/cf-tools/out/src/cli.js": mocks["@sap/cf-tools/out/src/cli.js"],
                "@sap/cf-tools/out/src/cf-local.js": mocks["@sap/cf-tools/out/src/cf-local.js"],
                "@sap/cf-tools/out/src/utils.js": mocks["@sap/cf-tools/out/src/utils.js"]
            });

            await CFUtil.getOrCreateServiceKeyWithEndpoints("test-service");
        });
    });

    describe("processErrors direct unit tests", () => {
        it("throws AuthenticationError when error title is CF-NotAuthenticated", () => {
            const json = { errors: [{ title: "CF-NotAuthenticated", code: 12345, detail: "Auth issue" }] } as any;
            expect(() => CFUtil.processCfErrors(json.errors)).to.throw("Authentication error. Use 'cf login' to authenticate in Cloud Foundry: Auth issue");
        });
        it("throws AuthenticationError when error code is 10002", () => {
            const json = { errors: [{ title: "SomeOther", code: 10002, detail: "Auth code issue" }] } as any;
            expect(() => CFUtil.processCfErrors(json.errors)).to.throw("Authentication error. Use 'cf login' to authenticate in Cloud Foundry: Auth code issue");
        });
        it("throws generic Error for non-auth errors", () => {
            const json = { errors: [{ title: "CF-Other", code: 99999, detail: "Other issue" }] } as any;
            expect(() => CFUtil.processCfErrors(json.errors)).to.throw("Failed sending request to Cloud Foundry: [{\"title\":\"CF-Other\",\"code\":99999,\"detail\":\"Other issue\"}]");
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