const fs = require("fs");
const assert = require("assert");
const path = require("path");
const Resource = require("@ui5/fs/lib/Resource");
const appVariantBundler = require("../lib/appVariantBundler");
const mock = require("mock-require");

describe("appVariantBundler", () => {

    before("set log level silent", () => {
        const loggerMock = mock.reRequire("@ui5/logger");
        loggerMock.setLevel("silent");
    });

    after("reset mock", () => {
        mock.stopAll();
    });

    let appVariantResources;
    beforeEach("reset resources", () => {
        appVariantResources = [{
            path: "manifest.appdescr_variant",
            statInfo: null,
            string: readFile("original/manifest.appdescr_variant")
        }, {
            path: "i18n/i18n.properties",
            statInfo: null,
            string: readFile("original/i18n.properties")
        }];
    });

    describe("without parameters", () => {
        const workspace = {
            byGlob: () => Promise.resolve(appVariantResources.map((r) => createResource(r, "namespace")))
        };

        it("should throw error", async () => {
            try {
                await appVariantBundler({ workspace });
            } catch (error) {
                assert.deepEqual(error.message, "Missing parameters: appHostId, appName, appVersion", "Should throw an error");
            }
        });
    });

    describe("with empty resources", () => {
        const workspace = {
            byGlob: () => Promise.resolve([])
        };
        it("should return empty array", async () => {
            const result = await appVariantBundler({ workspace });
            assert.deepEqual(result, []);
        });
    });

    describe("with namespace", () => {
        const options = {
            projectNamespace: "customer/sap/ui/rta/test/variantManagement/business/service",
            configuration: {
                appHostId: "appHostId",
                appName: "appName",
                appVersion: "appVersion"
            }
        };
        const results = [];
        const workspace = {
            byGlob: () => Promise.resolve(appVariantResources.map((r) => createResource(r, options.projectNamespace))),
            write: (resources) => {
                results.push(resources);
                return Promise.resolve();
            }
        };
        it("should return resources array", async () => {
            await appVariantBundler({
                workspace,
                options,
                cfUtil: {
                    getSpace: () => Promise.resolve({ GUID: "guid" }),
                    getHtml5RepoCredentials: () => Promise.resolve({}),
                    getToken: () => Promise.resolve(""),
                    downloadZip: () => fs.promises.readFile(__dirname + "/resources/original/baseapp.zip"),
                }
            });
            assert.deepEqual(results.length, 6);
            assertPaths(results, [
                "/resources/customer/sap/ui/rta/test/variantManagement/business/service/manifest.json",
                "/resources/customer/sap/ui/rta/test/variantManagement/business/service/appvariant-a6eed165/i18n/i18n.properties"
            ]);
        });
    });

    describe("without change texts", () => {
        const options = {
            projectNamespace: "customer/sap/ui/rta/test/variantManagement/business/service",
            configuration: {
                appHostId: "appHostId",
                appName: "appName",
                appVersion: "appVersion"
            }
        };
        const results = [];
        it("should return resources array", async () => {
            appVariantResources = [{
                path: "manifest.appdescr_variant",
                statInfo: null,
                string: readFile("original/manifest_no_change_texts.appdescr_variant")
            }, {
                path: "i18n/i18n.properties",
                statInfo: null,
                string: readFile("original/i18n.properties")
            }];
            const workspace = {
                byGlob: () => Promise.resolve(appVariantResources.map((r) => createResource(r, options.projectNamespace))),
                write: (resources) => {
                    results.push(resources);
                    return Promise.resolve();
                }
            };
            await appVariantBundler({
                workspace,
                options,
                cfUtil: {
                    getSpace: () => Promise.resolve({ GUID: "guid" }),
                    getHtml5RepoCredentials: () => Promise.resolve({}),
                    getToken: () => Promise.resolve(""),
                    downloadZip: () => fs.promises.readFile(__dirname + "/resources/original/baseapp.zip"),
                }
            });
            const manifestContent = await results.find(res => res.getPath().endsWith("manifest.json")).getBuffer().then(JSON.parse);
            assert.deepStrictEqual(manifestContent, JSON.parse(readFile("/expected/manifest_no_change_texts.json")));
        });
    });

    describe("without namespace", () => {
        const options = {
            configuration: {
                appHostId: "appHostId",
                appName: "appName",
                appVersion: "appVersion"
            }
        };
        const results = [];
        const workspace = {
            byGlob: () => Promise.resolve(appVariantResources.map((r) => createResource(r, options.namespace))),
            write: (resources) => {
                results.push(resources);
                return Promise.resolve();
            }
        };
        it("should return resources array", async () => {
            await appVariantBundler({
                workspace,
                options,
                cfUtil: {
                    getSpace: () => Promise.resolve({ GUID: "guid" }),
                    getHtml5RepoCredentials: () => Promise.resolve({}),
                    getToken: () => Promise.resolve(""),
                    downloadZip: () => fs.promises.readFile(__dirname + "/resources/original/baseapp.zip"),
                }
            });
            assert.deepEqual(results.length, 6);
            assertPaths(results, [
                "/resources/manifest.json",
                "/resources/appvariant-a6eed165/i18n/i18n.properties"
            ]);
        });
    });

    describe("with base application", () => {
        const options = {
            projectNamespace: "customer/sap/ui/rta/test/variantManagement/business/service",
            configuration: {
                appHostId: "appHostId",
                appName: "appName",
                appVersion: "appVersion"
            }
        };
        const results = [];
        const workspace = {
            byGlob: () => Promise.resolve(appVariantResources.map((r) => createResource(r, options.projectNamespace))),
            write: (resources) => {
                results.push(resources);
                return Promise.resolve();
            }
        };
        it("should return resources array", async () => {
            await appVariantBundler({
                workspace,
                options,
                cfUtil: {
                    getSpace: () => Promise.resolve({ GUID: "guid" }),
                    getHtml5RepoCredentials: () => Promise.resolve({}),
                    getToken: () => Promise.resolve(""),
                    downloadZip: () => fs.promises.readFile(
                        __dirname + "/resources/original/baseapp.zip"),
                }
            });
            const manifestContent = await results.find(res => res.getPath().endsWith("manifest.json")).getBuffer().then(JSON.parse);
            assert.deepEqual(results.length, 6);
            assertPaths(results, [
                "/resources/customer/sap/ui/rta/test/variantManagement/business/service/manifest.json",
                "/resources/customer/sap/ui/rta/test/variantManagement/business/service/appvariant-a6eed165/i18n/i18n.properties"
            ]);
            assert.deepEqual(manifestContent, JSON.parse(readFile("/expected/manifest_no_sap_cloud.json")));
        });
    });

    describe("with existing module", () => {
        const options = {
            projectNamespace: "customer/sap/ui/rta/test/variantManagement/business/service",
            configuration: {
                appHostId: "appHostId",
                appName: "appName",
                appVersion: "appVersion",
                sapCloudService: "grc.risk"
            }
        };
        const results = [];
        const workspace = {
            byGlob: () => Promise.resolve(appVariantResources.map((r) => createResource(r, options.projectNamespace))),
            write: (resources) => {
                results.push(resources);
                return Promise.resolve();
            }
        };
        it("should return resources array", async () => {
            await appVariantBundler({
                workspace,
                options,
                cfUtil: {
                    getSpace: () => Promise.resolve({ GUID: "guid" }),
                    getHtml5RepoCredentials: () => Promise.resolve({}),
                    getToken: () => Promise.resolve(""),
                    downloadZip: () => fs.promises.readFile(
                        __dirname + "/resources/original/baseapp-existingmodule.zip"),
                }
            });
            const manifestContent = await results.find(r => r.getPath().endsWith("manifest.json")).getBuffer().then(JSON.parse);
            assert.deepEqual(results.length, 8);
            assertPaths(results, [
                "/resources/customer/sap/ui/rta/test/variantManagement/business/service/manifest.json",
                "/resources/customer/sap/ui/rta/test/variantManagement/business/service/appvariant-a6eed165/i18n/i18n.properties"
            ]);
            assert.deepEqual(manifestContent, JSON.parse(readFile("/expected/manifest.json")));
        });
    });

    describe("with CFUtil", () => {
        mock("request", {
            get: (uri, options, callback) => {
                if (uri === "https://html5repo.sap.com/applications/content/appName-appVersion/") {
                    return {
                        on: (event, onDataCallback) => {
                            onDataCallback(fs.readFileSync(__dirname + "/../../../fixtures/application.k/testdata-original/baseapp.zip"));
                            return {
                                on: (event, onEndCallback) => {
                                    onEndCallback();
                                }
                            };
                        }
                    };
                } else {
                    callback(undefined, undefined, JSON.stringify({ access_token: "token" }));
                }
            }
        });
        mock("@sap/cf-tools/out/src/cf-local", {
            cfGetConfigFileField: () => ({ GUID: "guid" }),
            cfGetInstanceCredentials: () => [{
                uaa: {
                    clientid: "clientid",
                    clientsecret: "clientsecret"
                },
                uri: "https://html5repo.sap.com"
            }]
        });
        mock("@sap/cf-tools/out/src/cli", {
            Cli: {
                execute: (req) => {
                    if (req[1] === "/v3/service_plans?space_guids=guid&names=app-runtime") {
                        return Promise.resolve({
                            exitCode: 0,
                            stdout: JSON.stringify({
                                resources: [{
                                    guid: "service-guid"
                                }]
                            })
                        });
                    } else if (req[1] === "/v2/service_instances?q=service_plan_guid:service-guid&q=space_guid:guid") {
                        return Promise.resolve({
                            exitCode: 0,
                            stdout: JSON.stringify({
                                resources: [{
                                    entity: {
                                        name: "service-instance-name"
                                    },
                                    metadata: {
                                        guid: "service-instance-guid"
                                    }
                                }]
                            })
                        });
                    }
                }
            }
        });
        const appVariantBundlerMock = mock.reRequire("../lib/appVariantBundler");
        const options = {
            projectNamespace: "customer/sap/ui/rta/test/variantManagement/business/service",
            configuration: {
                appHostId: "appHostId",
                appName: "appName",
                appVersion: "appVersion",
                sapCloudService: "grc.risk"
            }
        };
        const results = [];
        const workspace = {
            byGlob: () => Promise.resolve(appVariantResources.map((r) => createResource(r, options.projectNamespace))),
            write: (resources) => {
                results.push(resources);
                return Promise.resolve();
            }
        };
        it("should return resources array", async () => {
            await appVariantBundlerMock({
                workspace,
                options,
                cfUtil: {
                    getSpace: () => Promise.resolve({ GUID: "guid" }),
                    getHtml5RepoCredentials: () => Promise.resolve({}),
                    getToken: () => Promise.resolve(""),
                    downloadZip: () => fs.promises.readFile(
                        __dirname + "/resources/original/baseapp-existingmodule.zip"),
                }
            });
            const manifestContent = await results.find(r => r.getPath().endsWith("manifest.json")).getBuffer().then(JSON.parse);
            assert.deepEqual(results.length, 8);
            assertPaths(results, [
                "/resources/customer/sap/ui/rta/test/variantManagement/business/service/manifest.json",
                "/resources/customer/sap/ui/rta/test/variantManagement/business/service/appvariant-a6eed165/i18n/i18n.properties"
            ]);
            assert.deepStrictEqual(manifestContent, JSON.parse(readFile("/expected/manifest.json")));
        });
    });
});

function createResource(resource, namespace) {
    const clone = Object.assign({}, resource);
    clone.path = "resources/" + (namespace ? namespace + "/" : "") + clone.path;
    return new Resource(clone);
}

function readFile(folder) {
    return fs.readFileSync(path.join(__dirname, "resources", folder), "utf-8");
}

function assertPaths(actual, expected) {
    let found = [];
    for (const expect of expected) {
        for (const result of actual) {
            if (result.getPath() === expect) {
                if (!found.includes(expect)) {
                    found.push(expect);
                }
            }
        }
    }
    assert.deepEqual(found.length, expected.length,
        "actual: " + actual.map(a => a.getPath()) + "\r\nexpected: " + expected);
}