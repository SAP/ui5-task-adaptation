import * as chai from "chai";
import * as sinon from "sinon";

import { IProjectOptions } from "../../../src/model/types.js";
import ServerError from "../../../src/model/serverError.js";
import { SinonSandbox } from "sinon";
import TestUtil from "../testUtilities/testUtil.js";
import esmock from "esmock";

const { assert, expect } = chai;

describe("Html5RepoManager", () => {
    let sandbox: SinonSandbox;
    const options: IProjectOptions = {
        projectNamespace: "ns",
        configuration: {
            appHostId: "appHostId",
            appId: "appId",
            appName: "appName",
            appVersion: "appVersion",
            space: "spaceGuid",
            org: "orgGuid",
            sapCloudService: "sapCloudService"
        }
    };

    beforeEach(async () => sandbox = sinon.createSandbox());
    afterEach(() => sandbox.restore());

    it("should download archive from htlm5 repo", async () => {
        let requestUtilGetCall = 0;
        const credentialsJson = JSON.parse(TestUtil.getResource("credentials_bs.json"));
        const Html5RepoManager = await esmock("../../../src/repositories/html5RepoManager.js", {}, {
            "@sap/cf-tools/out/src/cli.js": {
                Cli: {
                    execute: () => TestUtil.getStdOut(TestUtil.getResource("service_instances_repo.json"))
                }
            },
            "@sap/cf-tools/out/src/cf-local.js": {
                cfGetInstanceCredentials: () => Promise.resolve(credentialsJson)
            },
            "../../../src/util/requestUtil.js": {
                default: {
                    get: () => requestUtilGetCall++ == 0
                        ? Promise.resolve({ "access_token": "accessToken1" })
                        : Promise.resolve(TestUtil.getResourceBuffer("baseapp.zip"))
                }
            }
        });
        const baseAppFiles = await Html5RepoManager.getBaseAppFiles(options.configuration);
        expect([...baseAppFiles.keys()]).to.have.members(["i18n.properties", "manifest.json"]);
    });

    it("should throw an exception because of corrupt archive", async () => {
        let requestUtilGetCall = 0;
        const credentialsJson = JSON.parse(TestUtil.getResource("credentials_bs.json"));
        const Html5RepoManager = await esmock("../../../src/repositories/html5RepoManager.js", {}, {
            "@sap/cf-tools/out/src/cli.js": {
                Cli: {
                    execute: () => TestUtil.getStdOut(TestUtil.getResource("service_instances_repo.json"))
                }
            },
            "@sap/cf-tools/out/src/cf-local.js": {
                cfGetInstanceCredentials: () => Promise.resolve(credentialsJson)
            },
            "../../../src/util/requestUtil.js": {
                default: {
                    get: () => requestUtilGetCall++ == 0
                        ? Promise.resolve({ "access_token": "accessToken1" })
                        : Promise.resolve(TestUtil.getResourceBuffer("baseapp-corrupt.zip"))
                }
            }
        });
        try {
            await Html5RepoManager.getBaseAppFiles(options.configuration)
            assert.fail(true, false, "Exception not thrown");
        } catch (error: any) {
            expect(error.message).to.equal("Failed to parse zip content from HTML5 Repository: ADM-ZIP: Number of disk entries is too large");
        }
    });

    it("should request metadata", async () => {
        const METADATA = {
            appHostId: options.configuration.appHostId,
            applicationName: options.configuration.appName,
            applicationVersion: options.configuration.appVersion,
            changedOn: "2100.01.01"
        };
        const credentialsJson = JSON.parse(TestUtil.getResource("credentials_bs.json"));
        const Html5RepoManager = await esmock("../../../src/repositories/html5RepoManager.js", {}, {
            "@sap/cf-tools/out/src/cli.js": {
                Cli: {
                    execute: () => TestUtil.getStdOut(TestUtil.getResource("service_instances_repo.json"))
                }
            },
            "@sap/cf-tools/out/src/cf-local.js": {
                cfGetInstanceCredentials: () => Promise.resolve(credentialsJson)
            },
            "../../../src/util/requestUtil.js": {
                default: {
                    get: (url: string) => {
                        if (url === "html5UaaUrl/oauth/token?grant_type=client_credentials") {
                            return Promise.resolve({ "access_token": "accessToken1" });
                        } else if (url === "html5Uri/applications/metadata/") {
                            return Promise.resolve([METADATA]);
                        }
                    }
                }
            }
        });
        const metadata = await Html5RepoManager.getMetadata(options.configuration);
        expect(metadata).to.eql(METADATA);
    });

    it("should download reuse lib from htlm5 repo", async () => {
        let requestUtilGetCall = 0;
        const credentialsJson = JSON.parse(TestUtil.getResource("credentials_bs.json"));
        const Html5RepoManager = await esmock("../../../src/repositories/html5RepoManager.js", {}, {
            "@sap/cf-tools/out/src/cli.js": {
                Cli: {
                    execute: () => TestUtil.getStdOut(TestUtil.getResource("service_instances_repo.json"))
                }
            },
            "@sap/cf-tools/out/src/cf-local.js": {
                cfGetInstanceCredentials: () => Promise.resolve(credentialsJson)
            },
            "../../../src/util/requestUtil.js": {
                default: {
                    get: () => requestUtilGetCall++ == 0
                        ? Promise.resolve({ "access_token": "accessToken1" })
                        : Promise.resolve(TestUtil.getResourceBuffer("baseapp.zip"))
                }
            }
        });
        const reuseLibFiles = await Html5RepoManager.getReuseLibFiles(options.configuration, { name: "lib1" });
        expect([...reuseLibFiles.keys()]).to.have.members(["i18n.properties", "manifest.json"]);
    });

    describe("when downloading archive with various status codes", () => {
        const downloadUrl = "html5Uri/applications/content/appName-appVersion/";
        const tokenUrl = "html5UaaUrl/oauth/token?grant_type=client_credentials";

        const statusCases = [
            { status: 200, message: "Success", shouldError: false },
            { status: 400, message: "Bad Request.", shouldError: true },
            { status: 401, message: "Unauthorized", shouldError: true },
            { status: 403, message: "Forbidden", shouldError: true },
            { status: 404, message: "Resource not found.", shouldError: true },
            { status: 500, message: "Internal Server Error.", shouldError: true },
            { status: 503, message: "Application not found.", shouldError: true }
        ];

        statusCases.forEach(({ status, message, shouldError }) => {
            it(`should handle HTTP ${status}`, async () => {
                let expectedStatusUsed: number | undefined;
                const credentialsJson = JSON.parse(TestUtil.getResource("credentials_bs.json"));
                const Html5RepoManager = await esmock("../../../src/repositories/html5RepoManager.js", {}, {
                    "@sap/cf-tools/out/src/cli.js": {
                        Cli: {
                            execute: () => TestUtil.getStdOut(TestUtil.getResource("service_instances_repo.json"))
                        }
                    },
                    "@sap/cf-tools/out/src/cf-local.js": {
                        cfGetInstanceCredentials: () => Promise.resolve(credentialsJson)
                    },
                    "../../../src/util/requestUtil.js": {
                        default: {
                            get: (url: string, _requestOptions: any, expectedStatus: number = 200) => {
                                if (url === tokenUrl) {
                                    return Promise.resolve({ "access_token": "accessToken1" });
                                }
                                if (url === downloadUrl) {
                                    expectedStatusUsed = expectedStatus;
                                    if (status === expectedStatus) {
                                        return Promise.resolve(TestUtil.getResourceBuffer("baseapp.zip"));
                                    }
                                    if (status >= 500) {
                                        throw new ServerError(url, { response: { status, data: ` ${message}` } });
                                    }
                                    throw new Error(`Unexpected response received from '${url}': ${status} ${message}`);
                                }
                                throw new Error(`Unexpected url '${url}'`);
                            }
                        }
                    }
                });

                if (shouldError) {
                    try {
                        await Html5RepoManager.getBaseAppFiles(options.configuration);
                        assert.fail(true, false, "Exception not thrown");
                    } catch (error: any) {
                        if (status >= 500) {
                            expect(error.message).to.equal(`Request ${downloadUrl} failed with Server error: ${status} ${message}`);
                        } else {
                            expect(error.message).to.equal(`Unexpected response received from '${downloadUrl}': ${status} ${message}`);
                        }
                    }
                } else {
                    const baseAppFiles = await Html5RepoManager.getBaseAppFiles(options.configuration);
                    expect([...baseAppFiles.keys()]).to.have.members(["i18n.properties", "manifest.json"]);
                }
                expect(expectedStatusUsed).to.equal(200);
            });
        });
    });
});
