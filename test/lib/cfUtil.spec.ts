import * as chai from "chai";
import * as sinon from "sinon";
import chaiAsPromised from "chai-as-promised";

import CFUtil from "../../src/util/cfUtil.js";
import { Cli } from "@sap/cf-tools/out/src/cli.js";
import { IGetServiceInstanceParams } from "../../src/model/types.js";
import { SinonSandbox } from "sinon";
import TestUtil from "./testUtilities/testUtil.js";
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
        hasExistingKey?: boolean;
        hasValidEndpoints?: boolean;
        serviceExists?: boolean;
        serviceInstanceName?: string;
        spaceGuid?: string;
    } = {}) => {
        const {
            createKeyCallCount = 0,
            hasExistingKey = false,
            hasValidEndpoints = true,
            serviceExists = true,
            serviceInstanceName = "test-service",
            spaceGuid = "test-space"
        } = options;

        let createCallCount = createKeyCallCount;
        const keyHasData = () => hasExistingKey || createCallCount > 0;
        const serviceKeyName = `${serviceInstanceName}_key`;

        const validEndpoints = {
            endpoints: {
                "api-endpoint": {
                    url: "https://api.example.com",
                    destination: "api-dest"
                }
            }
        };

        const invalidEndpoints = {
            endpoints: "invalid-string-endpoint"
        };

        const credentialsWithValidEndpoints = {
            credentials: validEndpoints
        };

        const credentialsWithInvalidEndpoints = {
            credentials: invalidEndpoints
        };

        const keyGuid = "test-key-guid";

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
                            if (!keyHasData()) {
                                return TestUtil.getStdOut({ "resources": [] });
                            } else {
                                return TestUtil.getStdOut({
                                    "resources": [{ "name": serviceKeyName, "guid": keyGuid, "created_at": "2024-01-01T00:00:00Z" }]
                                });
                            }
                        } else if (args[1] === `/v3/service_credential_bindings/${keyGuid}/details`) {
                            return TestUtil.getStdOut({ credentials: hasValidEndpoints ? validEndpoints : invalidEndpoints });
                        } else if (args[0] === "create-service-key" && args[1] === serviceInstanceName && args[2] === serviceKeyName) {
                            createCallCount++;
                            return TestUtil.getStdOut("");
                        }
                    }
                }
            },
            "@sap/cf-tools/out/src/utils.js": {
                getSpaceGuidThrowIfUndefined: () => Promise.resolve(spaceGuid)
            },
            getCounters: () => ({ createCallCount }),
            getCredentials: () => hasValidEndpoints ? credentialsWithValidEndpoints : credentialsWithInvalidEndpoints
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
            const keyGuid = "serviceInstance1KeyGuid";
            let bindingsCallCount = 0;
            const CFUtil = await esmock("../../src/util/cfUtil.js", {}, {
                "@sap/cf-tools/out/src/cli.js": {
                    Cli: {
                        execute: (args: string[]) => {
                            if (args[1] === "/v3/service_instances?space_guids=spaceGuid1&names=serviceInstance1") {
                                return TestUtil.getStdOut(TestUtil.getResource("service_instances_bs.json"));
                            } else if (args[1] === "/v3/service_credential_bindings?type=key&service_instance_guids=serviceInstance1Guid") {
                                if (bindingsCallCount++ === 0) {
                                    return TestUtil.getStdOut({ resources: [] });
                                }
                                return TestUtil.getStdOut({ resources: [{ name: "serviceInstance1_key", guid: keyGuid, created_at: "2024-01-01T00:00:00Z" }] });
                            } else if (args[1] === `/v3/service_credential_bindings/${keyGuid}/details`) {
                                return TestUtil.getStdOut({ credentials: credentialsJson[0].credentials });
                            } else if (args[0] === "create-service-key" && args[1] === "serviceInstance1" && args[2] === "serviceInstance1_key") {
                                return TestUtil.getStdOut("");
                            }
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
                    name: "serviceInstance1",
                    type: "managed"
                }
            });
        });

        it("should return existing service keys without creating a new one", async () => {
            const credentialsJson = JSON.parse(TestUtil.getResource("credentials_bs.json"));
            const keyGuid = "serviceInstance1KeyGuid";
            let createCallCount = 0;
            const CFUtil = await esmock("../../src/util/cfUtil.js", {}, {
                "@sap/cf-tools/out/src/cli.js": {
                    Cli: {
                        execute: (args: string[]) => {
                            if (args[1] === "/v3/service_instances?space_guids=spaceGuid1&names=serviceInstance1") {
                                return TestUtil.getStdOut(TestUtil.getResource("service_instances_bs.json"));
                            } else if (args[1] === "/v3/service_credential_bindings?type=key&service_instance_guids=serviceInstance1Guid") {
                                return TestUtil.getStdOut({ resources: [{ name: "serviceInstance1_key", guid: keyGuid, created_at: "2024-01-01T00:00:00Z" }] });
                            } else if (args[1] === `/v3/service_credential_bindings/${keyGuid}/details`) {
                                return TestUtil.getStdOut({ credentials: credentialsJson[0].credentials });
                            } else if (args[0] === "create-service-key") {
                                createCallCount++;
                                return TestUtil.getStdOut("");
                            }
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
                    name: "serviceInstance1",
                    type: "managed"
                }
            });
            expect(createCallCount).to.equal(0);
        });

        it("should throw an exception when after creating service keys are not found", async () => {
            const CFUtil = await esmock("../../src/util/cfUtil.js", {}, {
                "@sap/cf-tools/out/src/cli.js": {
                    Cli: {
                        execute: (args: string[]) => {
                            if (args[1] === "/v3/service_instances?space_guids=spaceGuid1&names=serviceInstance1") {
                                return TestUtil.getStdOut(TestUtil.getResource("service_instances_bs.json"));
                            } else if (args[1] === "/v3/service_credential_bindings?type=key&service_instance_guids=serviceInstance1Guid") {
                                return TestUtil.getStdOut({ resources: [] });
                            } else if (args[0] === "create-service-key" && args[1] === "serviceInstance1" && args[2] === "serviceInstance1_key") {
                                return TestUtil.getStdOut("");
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
                expect(error.message).to.equal("Service key was created for 'serviceInstance1' but could not be retrieved");
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

        it("should fetch credentials directly for user-provided service instance", async () => {
            const expectedCredentials = { uri: "https://my-service.example.com", username: "user", password: "pass" };
            const CFUtil = await esmock("../../src/util/cfUtil.js", {}, {
                "@sap/cf-tools/out/src/cli.js": {
                    Cli: {
                        execute: (args: string[]) => {
                            if (args[1] === "/v3/service_instances?space_guids=spaceGuid1&names=myUpsi") {
                                return TestUtil.getStdOut({
                                    resources: [{ name: "myUpsi", guid: "upsiGuid", type: "user-provided" }]
                                });
                            } else if (args[1] === "/v3/service_instances/upsiGuid/credentials") {
                                return TestUtil.getStdOut({ credentials: expectedCredentials });
                            }
                        }
                    }
                }
            });
            const result = await CFUtil.getServiceInstanceKeys({
                spaceGuids: ["spaceGuid1"],
                names: ["myUpsi"]
            });
            expect(result).to.eql({
                credentials: expectedCredentials,
                serviceInstance: { guid: "upsiGuid", name: "myUpsi", type: "user-provided" }
            });
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
            const keyGuid = "serviceInstance1KeyGuid";
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
                            } else if (args[1] === "/v3/service_credential_bindings?type=key&service_instance_guids=serviceInstance1Guid") {
                                return TestUtil.getStdOut({ resources: [{ name: "serviceInstance1_key", guid: keyGuid, created_at: "2024-01-01T00:00:00Z" }] });
                            } else if (args[1] === `/v3/service_credential_bindings/${keyGuid}/details`) {
                                return TestUtil.getStdOut({ credentials: credentialsJson[0].credentials });
                            }
                        }
                    }
                },
                "@sap/cf-tools/out/src/cf-local.js": {
                    cfCreateService: () => Promise.resolve()
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
                    name: "serviceInstance1",
                    type: "managed"
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

    describe("when getting or creating service keys with endpoints", () => {

        it("should use existing service key with valid endpoints", async () => {
            const mocks = createServiceKeyEndpointMocks({ hasExistingKey: true });
            const credentials = mocks.getCredentials();

            const CFUtil = await esmock("../../src/util/cfUtil.js", {}, {
                "@sap/cf-tools/out/src/cli.js": mocks["@sap/cf-tools/out/src/cli.js"],
                "@sap/cf-tools/out/src/utils.js": mocks["@sap/cf-tools/out/src/utils.js"]
            });

            const result = await CFUtil.getOrCreateServiceKeyWithEndpoints("test-service", "test-space");
            expect(result).to.deep.equal(credentials.credentials);
            expect(mocks.getCounters().createCallCount).to.equal(0);
        });

        it("should create new service key when none exist", async () => {
            const mocks = createServiceKeyEndpointMocks();
            const credentials = mocks.getCredentials();

            const CFUtil = await esmock("../../src/util/cfUtil.js", {}, {
                "@sap/cf-tools/out/src/cli.js": mocks["@sap/cf-tools/out/src/cli.js"],
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
                "@sap/cf-tools/out/src/utils.js": mocks["@sap/cf-tools/out/src/utils.js"]
            });

            const result = await CFUtil.getOrCreateServiceKeyWithEndpoints("test-service");
            expect(result).to.deep.equal(mocks.getCredentials().credentials);
        });

        it("should use the newest service key when multiple keys exist", async () => {
            const newestKeyGuid = "newest-key-guid";
            const validEndpoints = {
                endpoints: { "api-endpoint": { url: "https://api.example.com", destination: "api-dest" } }
            };
            let createCallCount = 0;
            const CFUtil = await esmock("../../src/util/cfUtil.js", {}, {
                "@sap/cf-tools/out/src/cli.js": {
                    Cli: {
                        execute: (args: string[]) => {
                            if (args[1] === "/v3/service_instances?names=test-service&space_guids=test-space") {
                                return TestUtil.getStdOut({ "resources": [{ "name": "test-service", "guid": "test-guid" }] });
                            } else if (args[1] === "/v3/service_credential_bindings?type=key&service_instance_guids=test-guid") {
                                return TestUtil.getStdOut({
                                    "resources": [
                                        { "name": "old-key", "guid": "old-key-guid", "created_at": "2023-01-01T00:00:00Z" },
                                        { "name": "newest-key", "guid": newestKeyGuid, "created_at": "2025-01-01T00:00:00Z" },
                                        { "name": "mid-key", "guid": "mid-key-guid", "created_at": "2024-01-01T00:00:00Z" }
                                    ]
                                });
                            } else if (args[1] === `/v3/service_credential_bindings/${newestKeyGuid}/details`) {
                                return TestUtil.getStdOut({ credentials: validEndpoints });
                            } else if (args[0] === "create-service-key") {
                                createCallCount++;
                                return TestUtil.getStdOut("");
                            }
                        }
                    }
                },
                "@sap/cf-tools/out/src/utils.js": {
                    getSpaceGuidThrowIfUndefined: () => Promise.resolve("test-space")
                }
            });

            const result = await CFUtil.getOrCreateServiceKeyWithEndpoints("test-service");
            expect(result).to.deep.equal(validEndpoints);
            expect(createCallCount).to.equal(0);
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