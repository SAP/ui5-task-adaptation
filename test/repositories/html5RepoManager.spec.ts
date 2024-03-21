import * as chai from "chai";
import * as sinon from "sinon";

import { IProjectOptions } from "../../src/model/types.js";
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
            spaceGuid: "spaceGuid",
            orgGuid: "orgGuid",
            sapCloudService: "sapCloudService"
        }
    };

    beforeEach(async () => sandbox = sinon.createSandbox());
    afterEach(() => sandbox.restore());

    it("should download archive from htlm5 repo", async () => {
        let requestUtilGetCall = 0;
        const credentialsJson = JSON.parse(TestUtil.getResource("credentials_bs.json"));
        const Html5RepoManager = await esmock("../../src/repositories/html5RepoManager.js", {}, {
            "@sap/cf-tools/out/src/cli.js": {
                Cli: {
                    execute: () => TestUtil.getStdOut(TestUtil.getResource("service_instances_repo.json"))
                }
            },
            "@sap/cf-tools/out/src/cf-local.js": {
                cfGetInstanceCredentials: () => Promise.resolve(credentialsJson)
            },
            "../../src/util/requestUtil.js": {
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
        const Html5RepoManager = await esmock("../../src/repositories/html5RepoManager.js", {}, {
            "@sap/cf-tools/out/src/cli.js": {
                Cli: {
                    execute: () => TestUtil.getStdOut(TestUtil.getResource("service_instances_repo.json"))
                }
            },
            "@sap/cf-tools/out/src/cf-local.js": {
                cfGetInstanceCredentials: () => Promise.resolve(credentialsJson)
            },
            "../../src/util/requestUtil.js": {
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
            expect(error.message).to.equal("Failed to parse zip content from HTML5 Repository: Invalid CEN header (bad signature)");
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
        const Html5RepoManager = await esmock("../../src/repositories/html5RepoManager.js", {}, {
            "@sap/cf-tools/out/src/cli.js": {
                Cli: {
                    execute: () => TestUtil.getStdOut(TestUtil.getResource("service_instances_repo.json"))
                }
            },
            "@sap/cf-tools/out/src/cf-local.js": {
                cfGetInstanceCredentials: () => Promise.resolve(credentialsJson)
            },
            "../../src/util/requestUtil.js": {
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

});