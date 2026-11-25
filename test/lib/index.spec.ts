import * as chai from "chai";
import * as sinon from "sinon";
import chaiAsPromised from "chai-as-promised";

import CacheHolder from "../../src/cache/cacheHolder.js";
import HTML5Repository from "../../src/repositories/html5Repository.js";
import AbapRepository from "../../src/repositories/abapRepository.js";
import { IProjectOptions } from "../../src/model/types.js";
import { SinonSandbox } from "sinon";
import TestUtil, { cachedResource, toBufferMap } from "./testUtilities/testUtil.js";
import CFUtil from "../../src/util/cfUtil.js";
import esmock from "esmock";
import IRepository from "../../src/repositories/repository.js";
import CFAdapter from "../../src/adapters/cfAdapter.js";
import AbapAdapter from "../../src/adapters/abapAdapter.js";
import AbapAnnotationManager from "../../src/annotations/abapAnnotationManager.js";
import ResourceUtil from "../../src/util/resourceUtil.js";
import { AbapServiceProvider } from "@sap-ux/axios-extension/dist/abap/abap-service-provider.js";

const { byIsOmited } = TestUtil;

chai.use(chaiAsPromised);
const { expect } = chai;

const OPTIONS: IProjectOptions = {
    projectNamespace: "ns",
    configuration: {
        appHostId: "appHostId",
        appId: "appId",
        appName: "repoName1",
        appVersion: "appVersion",
        space: "spaceGuid",
        org: "orgGuid",
        sapCloudService: "sapCloudService",
        target: {
            url: "https://example.sap.com"
        },
        type: "cf",
        serviceInstanceName: "serviceInstanceName"
    }
};

describe("Index", () => {
    let sandbox: SinonSandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        sandbox.stub(CFUtil, "getOrCreateServiceKeyWithEndpoints").resolves({
            endpoints: {
                "api-endpoint": { destination: "ZTEST_DEST" },
                "view-endpoint": { destination: "" },
                "ui-endpoint": "ui-dest"
            },
            "sap.cloud.service": "test-service"
        });
    });
    afterEach(() => {
        sandbox.restore();
        CacheHolder.clear();
    });

    it("should add enhanceWith to i18n model in manifest.json", async () => {
        const html5Repository = new HTML5Repository(OPTIONS.configuration);
        sandbox.stub(html5Repository, "getMetadata").resolves({ changedOn: "010101" });
        sandbox.stub(html5Repository, "getHtml5RepoInfo" as any).resolves({});
        const html5RepositoryStub = sandbox.stub(html5Repository, "getAppZipEntries" as any)
            .resolves(new Map([["manifest.json", TestUtil.getResource("manifest.json")]]));
        OPTIONS.configuration.languages = ["EN", "DE"];
        await runUi5TaskAdaptation(OPTIONS, true, html5Repository);
        expect(html5RepositoryStub.getCalls().length).to.equal(1);
        delete OPTIONS.configuration.languages;
    });

    [
        { testName: "string", manifestModification: () => { } },
        {
            testName: "bundleUrl", manifestModification: (baseAppFiles: Map<string, string>) => {
                const manifestJson = JSON.parse(baseAppFiles.get("manifest.json")!);
                manifestJson["sap.app"]["i18n"] = { "bundleUrl": "i18n/i18n.properties" };
                baseAppFiles.set("manifest.json", JSON.stringify(manifestJson));
            }
        },
        {
            testName: "bundleName", manifestModification: (baseAppFiles: Map<string, string>) => {
                const manifestJson = JSON.parse(baseAppFiles.get("manifest.json")!);
                manifestJson["sap.app"]["i18n"] = { "bundleName": "com.sap.base.app.id.i18n.i18n" };
                baseAppFiles.set("manifest.json", JSON.stringify(manifestJson));
            }
        }]
        .forEach((test) => {
            it(`should merge i18n files from base app and variant with given i18n manifest ${test.testName}`, async () => {
                const baseAppFiles = new Map([
                    ["manifest.json", TestUtil.getResource("manifest.json")],
                    ["i18n/i18n.properties", TestUtil.getResource("i18n.properties")],
                    ["xs-app.json", JSON.stringify({
                        routes: [{
                            source: "^/sap/opu/odata/sap/ZTEST_SRV/",
                            target: "/sap/opu/odata/sap/ZTEST_SRV/",
                            authenticationType: "none",
                            destination: "ZTEST_DEST"
                        }]
                    })]
                ]);
                test.manifestModification(baseAppFiles);
                const repository = new HTML5Repository(OPTIONS.configuration);
                const getMetadataStub = sandbox.stub(repository, "getMetadata").resolves({ changedOn: "2100.01.01" });
                const getHtml5RepoInfoStub = sandbox.stub(repository, "getHtml5RepoInfo" as any).resolves({});
                const getAppZipEntriesStub = sandbox.stub(repository, "getAppZipEntries" as any).resolves(baseAppFiles);
                const { workspace, taskUtil } = await getWorkspace(OPTIONS);

                const indexStub = await esmock("../../src/index.js", {
                    "../../src/landscapeConfiguration.js": {
                        initialize: () => {
                            const adapter = new CFAdapter(OPTIONS.configuration);
                            return {
                                repository,
                                adapter
                            };
                        }
                    }
                });
                await indexStub({ workspace, options: OPTIONS, taskUtil });

                const resources: any[] = (await workspace.byGlob("/**/*")).filter(byIsOmited(taskUtil));
                const resourcePaths = resources.map(r => r.getPath());
                const resourcePathMembers = [
                    "/resources/ns/manifest.json",
                    "/resources/ns/i18n/i18n.properties",
                    "/resources/ns/changes/id_1696839317667_propertyChange.change",
                    "/resources/ns/i18n/i18n_de.properties",
                    "/resources/ns/changes/customer_com_sap_application_variant_id/fragments/AdlChart.fragment.xml",
                    "/resources/ns/changes/customer_com_sap_application_variant_id/coding/id_12345.js",
                    "/resources/ns/changes/id_1707741869990_200_flVariant.ctrl_variant",
                    "/resources/ns/changes/id_1707749484507_210_setTitle.ctrl_variant_change",
                    "/resources/ns/changes/id_1707749484509_240_setDefault.ctrl_variant_management_change",
                    "/resources/ns/changes/id_1753705046493_197_codeExt.change",
                    "/resources/ns/changes/notsupported.testfile",
                    "/resources/ns/xs-app.json"
                ];
                const tempResources = await CacheHolder.read(cachedResource("repoName1", "2100.01.01"));
                const tempResourcesMembers = [
                    "i18n/i18n.properties",
                    "manifest.json",
                    "xs-app.json"
                ];
                checkResourcePathsAndTempResources(resourcePaths, resourcePathMembers, tempResources!, tempResourcesMembers);
                const i18nResources = resources.filter(resources => resources.getPath().includes("i18n"));

                const actualI18NFile = await Promise.all(i18nResources.map(async r => [r.getPath(), await r.getString()]));
                expect(actualI18NFile).to.have.deep.members([
                    ["/resources/ns/i18n/i18n_de.properties", TestUtil.getResource("i18n_de-expected.properties")],
                    ["/resources/ns/i18n/i18n.properties", TestUtil.getResource("i18n-expected.properties")]
                ]);

                const xsAppJson = resources.filter(resources => resources.getPath().includes("xs-app.json"));
                const xsAppJsonContent = JSON.parse(await xsAppJson[0].getString());
                expect(xsAppJsonContent.routes).to.deep.equal([{
                    source: "^/sap/opu/odata/sap/ZTEST_SRV/",
                    target: "/sap/opu/odata/sap/ZTEST_SRV/",
                    authenticationType: "basic",
                    destination: "OVERRIDE"
                }, {
                    source: "^/sap/opu/odata/sap/ZTEST_SRV/",
                    target: "/sap/opu/odata/sap/ZTEST_SRV/",
                    authenticationType: "none",
                    endpoint: "api-endpoint",
                    service: "test-service"
                }]);
                expect(getMetadataStub.getCalls().length).to.equal(1);
                expect(getHtml5RepoInfoStub.getCalls().length).to.equal(1);
                expect(getAppZipEntriesStub.getCalls().length).to.equal(1);
            });
        });

    it("should preserve adaptation project files when base app and appVariant are fetched", async () => {
        // Hierarchy: original app (REPO_NAME_0) → appVariant1 (REPO_NAME_1) → appVariant2 (adaptation project)
        // Original app and appVariant1 are fetched via repository and written to workspace.
        // The snapshot taken before fetching must restore adaptation project files so they
        // are not overwritten by the fetched files.
        const options: IProjectOptions = {
            projectNamespace: "ns",
            configuration: {
                target: { url: "https://example.sap.com" }
            }
        };

        const appVariant1Path = TestUtil.getResourcePath("appVariant1", "webapp");
        const abapRepository = new AbapRepository(options.configuration);
        sandbox.stub(AbapAnnotationManager.prototype, "process").resolves(new Map<string, string>());
        sandbox.stub(abapRepository, "getAppVariantIdHierarchy").resolves([
            { appName: "REPO_NAME_1", token: Promise.resolve("token1") },
            { appName: "REPO_NAME_0", token: Promise.resolve("token0") }
        ]);
        sandbox.stub(abapRepository, "fetch")
            .withArgs(sinon.match({ appName: "REPO_NAME_0" })).resolves(new Map([
                ["manifest.json", Buffer.from(TestUtil.getResource("manifest.json"))],
                ["manifest.appdescr_variant", Buffer.from(JSON.stringify({ id: "should.be.overwritten" }))],
            ]))
            .withArgs(sinon.match({ appName: "REPO_NAME_1" })).resolves(await ResourceUtil.byGlob(appVariant1Path, "**/*"));

        const { workspace, taskUtil } = await TestUtil.getWorkspace("appVariant2", options.projectNamespace);
        const index = await esmock("../../src/index.js", {}, {
            "../../src/landscapeConfiguration.js": {
                initialize: () => {
                    const adapter = new AbapAdapter(new AbapAnnotationManager(options.configuration, abapRepository));
                    return {
                        repository: abapRepository,
                        adapter
                    };
                }
            }
        });
        await index({ workspace, options, taskUtil });

        const resources: any[] = await workspace.byGlob("/**/*");
        const manifestVariant = resources.find(r => r.getPath().endsWith("manifest.appdescr_variant"));
        expect(manifestVariant, "manifest.appdescr_variant must exist in workspace").to.exist;
        const content = JSON.parse(await manifestVariant.getString());
        expect(content.id, "adaptation project manifest.appdescr_variant must not be overwritten by fetched base app file")
            .to.equal("customer.app.variant.2.id");
    });

    it("XsAppJsonEnhanceRoutesCommand: should rewrite destination->endpoint/service for matching routes and leave unmatched routes intact", async () => {
        const baseAppFiles = new Map([
            ["manifest.json", TestUtil.getResource("manifest.json")],
            ["i18n/i18n.properties", TestUtil.getResource("i18n.properties")],
            ["xs-app.json", JSON.stringify({
                authenticationMethod: "route",
                routes: [
                    {
                        source: "^/sap/opu/odata/sap/ZTEST_SRV/",
                        target: "/sap/opu/odata/sap/ZTEST_SRV/",
                        authenticationType: "none",
                        destination: "ZTEST_DEST"
                    },
                    {
                        source: "^/unmatched/(.*)$",
                        target: "/unmatched/$1",
                        authenticationType: "none",
                        destination: "NOT_IN_ENDPOINTS"
                    },
                    {
                        source: "^/no-destination/(.*)$",
                        target: "/no-destination/$1",
                        authenticationType: "none"
                    }
                ]
            })]
        ]);
        const repository = new HTML5Repository(OPTIONS.configuration);
        sandbox.stub(repository, "getMetadata").resolves({ changedOn: "2200.01.01" });
        sandbox.stub(repository, "getHtml5RepoInfo" as any).resolves({});
        sandbox.stub(repository, "getAppZipEntries" as any).resolves(baseAppFiles);
        const { workspace, taskUtil } = await getWorkspace(OPTIONS);

        const indexStub = await esmock("../../src/index.js", {
            "../../src/landscapeConfiguration.js": {
                initialize: () => {
                    const adapter = new CFAdapter(OPTIONS.configuration);
                    return {
                        repository,
                        adapter
                    };
                }
            }
        });
        await indexStub({ workspace, options: OPTIONS, taskUtil });

        const resources: any[] = (await workspace.byGlob("/**/*")).filter(byIsOmited(taskUtil));
        const xsAppJsonResource = resources.find(r => r.getPath().includes("xs-app.json"));
        const xsAppJson = JSON.parse(await xsAppJsonResource.getString());

        // Order: appVariant1 xs-app.json routes come first (merged by XsAppJsonMergeCommand),
        // then base app routes. XsAppJsonEnhanceRoutesCommand rewrites:
        //   - route with destination matching an endpoint -> destination dropped, endpoint+service added
        //   - route with destination NOT matching any endpoint -> kept untouched
        //   - route without destination -> kept untouched
        expect(xsAppJson.routes).to.deep.equal([
            {
                source: "^/sap/opu/odata/sap/ZTEST_SRV/",
                target: "/sap/opu/odata/sap/ZTEST_SRV/",
                authenticationType: "basic",
                destination: "OVERRIDE"
            },
            {
                source: "^/sap/opu/odata/sap/ZTEST_SRV/",
                target: "/sap/opu/odata/sap/ZTEST_SRV/",
                authenticationType: "none",
                endpoint: "api-endpoint",
                service: "test-service"
            },
            {
                source: "^/unmatched/(.*)$",
                target: "/unmatched/$1",
                authenticationType: "none",
                destination: "NOT_IN_ENDPOINTS"
            },
            {
                source: "^/no-destination/(.*)$",
                target: "/no-destination/$1",
                authenticationType: "none"
            }
        ]);
    });
});


describe("Index.previewManifest", () => {
    let sandbox: SinonSandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        sandbox.stub(CFUtil, "getOrCreateServiceKeyWithEndpoints").resolves({
            endpoints: {
                "api-endpoint": { destination: "ZTEST_DEST" },
                "view-endpoint": { destination: "" },
                "ui-endpoint": "ui-dest"
            },
            "sap.cloud.service": "test-service"
        });
    });
    afterEach(() => {
        sandbox.restore();
        CacheHolder.clear();
    });

    const REFERENCE = "com.sap.base.app.id";

    const setCache = async (files: Map<string, Buffer>) => {
        await CacheHolder.write(CacheHolder.mergedResource(REFERENCE), files);
    };

    const baseFiles = () => toBufferMap([
        ["manifest.json", TestUtil.getResource("manifest.json")],
        ["i18n/i18n.properties", TestUtil.getResource("i18n.properties")],
        ["xs-app.json", JSON.stringify({ routes: [] })]
    ]);

    const runPreview = async (files: Map<string, Buffer> = baseFiles(), options: IProjectOptions = OPTIONS) => {
        await setCache(files);
        const { workspace } = await TestUtil.getWorkspace("appVariant1", options.projectNamespace);
        const { previewManifest } = await import("../../src/index.js");
        return previewManifest({ workspace, options } as any);
    };

    [{
        name: "should rename base id and componentName to adaptation project id",
        assert: (manifest: any) => {
            expect(manifest["sap.app"].id).to.equal("customer.com.sap.application.variant.id");
            expect(manifest["sap.ui5"].componentName).to.equal("customer.com.sap.application.variant.id");
        }
    }, {
        name: "should add appVariantIdHierarchy to manifest.json",
        assert: (manifest: any) => {
            expect(manifest["sap.ui5"].appVariantIdHierarchy).to.be.an("array");
            expect(manifest["sap.ui5"].appVariantIdHierarchy[0].appVariantId).to.equal("com.sap.base.app.id");
        }
    }, {
        name: "should set sap.ui5.isCloudDevAdaptation to true",
        assert: (manifest: any) => expect(manifest["sap.ui5"].isCloudDevAdaptation).to.equal(true)
    }, {
        name: "should set sap.cloud.service from configuration",
        assert: (manifest: any) => expect(manifest["sap.cloud"].service).to.equal(OPTIONS.configuration.sapCloudService)
    }].forEach(({ name, assert }) => {
        it(name, async () => assert(await runPreview()));
    });

    it("should throw if the cached base app has no manifest.json", async () => {
        await expect(runPreview(toBufferMap([["i18n/i18n.properties", "hello=world"]])))
            .to.be.rejectedWith('Original application should have manifest.json in root folder');
    });

    it("should not call the HTML5 Repo when files are already cached", async () => {
        const hierarchySpy = sandbox.spy(HTML5Repository.prototype, "getAppVariantIdHierarchy");
        const getSpaceGuid = sandbox.spy(CFUtil, "getSpaceGuid");
        const writeSpy = sandbox.spy(CacheHolder, "write");
        await runPreview();
        expect(hierarchySpy.called).to.equal(false);
        expect(getSpaceGuid.called).to.equal(false);
        expect(writeSpy.calledTwice, "test setup writes once, previewManifest re-writes the merged cache").to.equal(true);
    });

    it("should preview ABAP manifests from the merged cache without calling the repo", async () => {
        const abapOptions: IProjectOptions = { ...OPTIONS, configuration: { ...OPTIONS.configuration, type: "abap" } };
        const hierarchySpy = sandbox.spy(AbapRepository.prototype, "getAppVariantIdHierarchy");
        const fetchSpy = sandbox.spy(AbapServiceProvider.prototype, "getUi5AbapRepository");
        const manifest = await runPreview(baseFiles(), abapOptions);
        expect(hierarchySpy.called).to.equal(false);
        expect(fetchSpy.called).to.equal(false);
        expect(manifest["sap.app"].id).to.equal("customer.com.sap.application.variant.id");
        expect(manifest["sap.ui5"].componentName).to.equal("customer.com.sap.application.variant.id");
        expect(manifest["sap.ui5"].appVariantIdHierarchy[0].appVariantId).to.equal("com.sap.base.app.id");
        expect(manifest["sap.ui5"].appVariantIdHierarchy[0].layer).to.equal("VENDOR");
    });

    it("should fall back to fetching and folding when the merged cache is empty", async () => {
        const abapOptions: IProjectOptions = { ...OPTIONS, configuration: { ...OPTIONS.configuration, type: "abap" } };
        const hierarchyStub = sandbox.stub(AbapRepository.prototype, "getAppVariantIdHierarchy")
            .resolves([{ appName: "repoName1", token: Promise.resolve("token0") }]);
        const fetchStub = sandbox.stub(AbapRepository.prototype, "fetch").resolves(baseFiles());
        const writeSpy = sandbox.spy(CacheHolder, "write");
        const { workspace } = await TestUtil.getWorkspace("appVariant1", abapOptions.projectNamespace);
        const { previewManifest } = await import("../../src/index.js");
        const manifest = await previewManifest({ workspace, options: abapOptions } as any);
        expect(hierarchyStub.called).to.equal(true);
        expect(fetchStub.called).to.equal(true);
        expect(writeSpy.calledOnce, "cache misses populate the merged cache").to.equal(true);
        const cached = await CacheHolder.read(CacheHolder.mergedResource(REFERENCE));
        expect([...cached.keys()]).to.have.members([...baseFiles().keys()]);
        expect(JSON.parse(cached.get("manifest.json")!.toString()))
            .to.deep.equal(JSON.parse(baseFiles().get("manifest.json")!.toString()));
        expect(manifest["sap.app"].id).to.equal("customer.com.sap.application.variant.id");
        expect(manifest["sap.ui5"].componentName).to.equal("customer.com.sap.application.variant.id");
    });

    it("should generate a manifest.json that matches the full build", async () => {
        const repository = new HTML5Repository(OPTIONS.configuration);
        sandbox.stub(repository, "getMetadata").resolves({ changedOn: "010101" });
        sandbox.stub(repository, "getHtml5RepoInfo" as any).resolves({});
        sandbox.stub(repository, "getAppZipEntries" as any).resolves(baseFiles());

        const { workspace: buildWorkspace, taskUtil: buildTaskUtil } =
            await TestUtil.getWorkspace("appVariant1", OPTIONS.projectNamespace);
        const indexStub = await esmock("../../src/index.js", {
            "../../src/landscapeConfiguration.js": {
                initialize: () => {
                    const adapter = new CFAdapter(OPTIONS.configuration);
                    return {
                        repository,
                        adapter
                    };
                }
            }
        });
        await indexStub({ workspace: buildWorkspace, options: OPTIONS, taskUtil: buildTaskUtil });
        const buildResources: any[] = (await buildWorkspace.byGlob("/**/*")).filter(byIsOmited(buildTaskUtil));
        const buildManifestResource = buildResources.find((r: any) => r.getPath().endsWith("manifest.json"));
        const buildManifest = JSON.parse(await buildManifestResource.getString());

        const { workspace: previewWorkspace } = await TestUtil.getWorkspace("appVariant1", OPTIONS.projectNamespace);
        const { previewManifest } = await import("../../src/index.js");
        const previewOutput = await previewManifest({ workspace: previewWorkspace, options: OPTIONS } as any);

        expect(JSON.stringify(buildManifest)).to.include('"enableMassEdit":true');
        expect(JSON.stringify(previewOutput)).to.include('"enableMassEdit":true');
        expect(previewOutput).to.deep.equal(buildManifest);
    });
});


describe("Index.downloadAppResources", () => {
    let sandbox: SinonSandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });
    afterEach(() => {
        sandbox.restore();
        CacheHolder.clear();
    });

    it("downloads and folds the whole hierarchy and writes it to outputDir", async () => {
        const abapOptions: IProjectOptions = { ...OPTIONS, configuration: { ...OPTIONS.configuration, type: "abap" } };
        const appVariant1Path = TestUtil.getResourcePath("appVariant1", "webapp");
        const processStub = sandbox.stub(AbapAnnotationManager.prototype, "process" as any)
            .resolves(new Map<string, string>([["annotations/annotation_test.xml", "<edmx/>"]]));
        const hierarchyStub = sandbox.stub(AbapRepository.prototype, "getAppVariantIdHierarchy").resolves([
            { appName: "REPO_NAME_1", token: Promise.resolve("token1") },
            { appName: "REPO_NAME_0", token: Promise.resolve("token0") }
        ]);
        const fetchStub = sandbox.stub(AbapRepository.prototype, "fetch");
        fetchStub.withArgs(sinon.match({ appName: "REPO_NAME_0" })).resolves(toBufferMap([
            ["manifest.json", TestUtil.getResource("manifest.json")]
        ]));
        fetchStub.withArgs(sinon.match({ appName: "REPO_NAME_1" })).resolves(await ResourceUtil.byGlob(appVariant1Path, "**/*"));

        await CacheHolder.write(CacheHolder.mergedResource("com.sap.base.app.id"), toBufferMap([
            ["manifest.json", JSON.stringify({ "sap.app": { id: "foo" } })]
        ]));
        const readSpy = sandbox.spy(CacheHolder, "read");
        const writeSpy = sandbox.spy(CacheHolder, "write");

        const outputDir = CacheHolder.getTempDir("downloadAppResources-test");
        const { workspace } = await TestUtil.getWorkspace("appVariant2", abapOptions.projectNamespace);
        const { downloadAppResources } = await import("../../src/index.js");
        await downloadAppResources({ workspace, options: abapOptions } as any, outputDir);

        expect(hierarchyStub.called, "fetches the hierarchy rather than reading the merged cache").to.equal(true);
        expect(fetchStub.called).to.equal(true);
        expect(readSpy.called, "downloads do not read the merged cache").to.equal(false);
        expect(writeSpy.called, "downloads do not write the merged cache").to.equal(false);

        const written = await ResourceUtil.byGlob(outputDir, "**/*");
        const manifest = JSON.parse(written.get("manifest.json")!.toString());

        expect(manifest["sap.app"].id).to.equal("customer.com.sap.application.variant.id");
        expect(manifest["sap.app"].id).to.not.equal("foo");
        expect(processStub.called, "annotations must not be downloaded").to.equal(false);
        expect(written.has("annotations/annotation_test.xml")).to.equal(false);
    });
});


const getWorkspace = async (options: IProjectOptions, appVariant: string = "appVariant1") => {
    const { workspace, taskUtil } = await TestUtil.getWorkspace(appVariant, options.projectNamespace);
    return { workspace, taskUtil }
}

const checkResourcePathsAndTempResources = (resourcePaths: any[], resourcePathsMembers: string[], tempResources: Map<string, Buffer>, tempResourcesMembers: string[]) => {
    resourcePaths.sort();
    resourcePathsMembers.sort();
    expect(resourcePaths).to.have.members(resourcePathsMembers);
    expect([...tempResources.keys()]).to.have.members(tempResourcesMembers);
}

const runUi5TaskAdaptation = async (options: IProjectOptions, hasEnhanceWithForI18NModel: boolean, repository: IRepository) => {
    const { workspace, taskUtil } = await getWorkspace(options);
    const indexStub = await esmock("../../src/index.js", {
        "../../src/landscapeConfiguration.js": {
            initialize: () => {
                const adapter = new CFAdapter(OPTIONS.configuration);
                return {
                    repository,
                    adapter
                };
            }
        }
    });
    await indexStub({ workspace, options, taskUtil });
    const resources: any[] = (await workspace.byGlob("/**/*")).filter(byIsOmited(taskUtil));
    const resourcePaths = resources.map(r => r.getPath());

    const manifestJsonResource: any = resources.find(resource => resource.getPath().includes("manifest.json")) as any;
    const manifestJson = JSON.parse(await manifestJsonResource?.getString());
    if (hasEnhanceWithForI18NModel && manifestJson) {
        expect(Object.keys(manifestJson["sap.ui5"]["models"]["@i18n"])).to.have.members(["type", "settings"]);
    } else {
        expect(Object.keys(manifestJson["sap.ui5"]["models"]["@i18n"])).to.not.have.members(["settings"]);
    }
    const resourcePathsMembers = [
        "/resources/ns/manifest.json",
        "/resources/ns/i18n/i18n_de.properties",
        "/resources/ns/changes/id_1696839317667_propertyChange.change",
        "/resources/ns/i18n/i18n.properties",
        "/resources/ns/changes/customer_com_sap_application_variant_id/fragments/AdlChart.fragment.xml",
        "/resources/ns/changes/customer_com_sap_application_variant_id/coding/id_12345.js",
        "/resources/ns/changes/id_1707741869990_200_flVariant.ctrl_variant",
        "/resources/ns/changes/id_1707749484507_210_setTitle.ctrl_variant_change",
        "/resources/ns/changes/id_1707749484509_240_setDefault.ctrl_variant_management_change",
        "/resources/ns/changes/id_1753705046493_197_codeExt.change",
        "/resources/ns/changes/notsupported.testfile",
        "/resources/ns/xs-app.json"
    ];
    const tempResources = await CacheHolder.read(cachedResource("repoName1", "010101"));
    checkResourcePathsAndTempResources(resourcePaths, resourcePathsMembers, tempResources!, ["manifest.json"]);
}
