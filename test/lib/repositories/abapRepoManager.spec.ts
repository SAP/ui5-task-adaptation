import * as sinon from "sinon";

import AbapRepoManager from "../../../src/repositories/abapRepoManager.js";
import { IProjectOptions } from "../../../src/model/types.js";
import { SinonSandbox } from "sinon";
import TestUtil from "../testUtilities/testUtil.js";
import esmock from "esmock";
import { expect } from "chai";

describe("AbapRepoManager", () => {
    let sandbox: SinonSandbox;
    const options: IProjectOptions = {
        projectNamespace: "ns",
        configuration: {
            destination: "abc",
            appName: "app/Name"
        }
    };

    let RESPONSE_DATA = { data: TestUtil.getResource("abap-response-archive.json") };

    before(() => process.env.H2O_URL = "test");
    after(() => delete process.env.H2O_URL);
    beforeEach(async () => sandbox = sinon.createSandbox());
    afterEach(() => sandbox.restore());

    it("should return map of files from archive", async () => {
        const { abapRepoManager, calls } = await prepareServiceStubs(RESPONSE_DATA);
        const baseAppFiles = await abapRepoManager.fetch("app/Name");
        expect([...baseAppFiles.keys()]).to.have.members(["i18n.properties", "manifest.json"]);
        expect(calls.ui5AbapRepositoryProps).to.eql("/Repositories('app%2FName')");
    });

    it("should throw exception when archive is empty", async () => {
        const responseClone = JSON.parse(RESPONSE_DATA.data);
        responseClone.d.ZipArchive = "";
        const { abapRepoManager } = await prepareServiceStubs({ data: JSON.stringify(responseClone) });
        await expect(abapRepoManager.fetch("app/Name"))
            .to.be.rejectedWith("App 'app/Name' doesn't contain files");
    });

    async function prepareServiceStubs(abapRepositoryResponse: any) {
        const calls = {
            ui5AbapRepositoryProps: ""
        };
        const AbapRepoManager = await mockAbapRepoManager({ abapRepositoryResponse, calls });
        const abapRepoManager = new AbapRepoManager(options.configuration);
        return { abapRepoManager, calls };
    }

    describe("getAppVariantIdHierarchy", () => {
        const appVariantIdHierarchyJson = {
            "appVariantIdHierarchy": [{
                "appVariantId": "appVar1",
                "repoName": "APP_VAR_1",
                "cachebusterToken": "~3B9623C59A5D02FAC13300DA1D98A0CD~5"
            }]
        };
        it("should return api result", async () => {
            const AbapRepoManager = await mockAbapRepoManager({
                lrepResponse: {
                    status: 200,
                    data: JSON.stringify(appVariantIdHierarchyJson)
                }
            });
            const abapRepoManager = new AbapRepoManager(options.configuration);
            const appVariantIdHierarchy = await abapRepoManager.getAppVariantIdHierarchy("baseApp1");
            expect(appVariantIdHierarchy).eql(appVariantIdHierarchyJson);
        });
        it("should fallback to metadata and configuration (has appName)", async () => {
            const AbapRepoManager = await mockAbapRepoManager({
                lrepResponse: {
                    status: 404,
                    data: JSON.stringify(appVariantIdHierarchyJson)
                },
                appIndexResponse: {
                    data: JSON.stringify({
                        appVar1: {
                            url: "010101"
                        }
                    })
                }
            });
            const abapRepoManager = new AbapRepoManager(options.configuration);
            const appVariantIdHierarchy = await abapRepoManager.getAppVariantIdHierarchy("appVar1");
            expect(appVariantIdHierarchy).eql([{
                repoName: "app/Name",
                appVariantId: "appVar1",
                cachebusterToken: "010101",
            }]);
        });
    });
});

async function mockAbapRepoManager({ abapRepositoryResponse, lrepResponse, appIndexResponse, calls }: any): Promise<typeof AbapRepoManager> {
    return esmock("../../../src/repositories/abapRepoManager.js", {}, {
        "@sap-ux/system-access": {
            createAbapServiceProvider: () => ({
                getUi5AbapRepository: () => {
                    return {
                        get: (props: any) => {
                            calls.ui5AbapRepositoryProps = props;
                            return Promise.resolve(abapRepositoryResponse);
                        }
                    }
                },
                getLayeredRepository: () => ({
                    get: () => Promise.resolve(lrepResponse)
                }),
                getAppIndex: () => ({
                    get: () => Promise.resolve(appIndexResponse)
                }),
            })
        }
    });
}
