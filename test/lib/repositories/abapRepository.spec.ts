import * as sinon from "sinon";

import AbapRepository from "../../../src/repositories/abapRepository.js";
import { IProjectOptions } from "../../../src/model/types.js";
import { SinonSandbox } from "sinon";
import TestUtil from "../testUtilities/testUtil.js";
import esmock from "esmock";
import { expect } from "chai";
import CacheHolder from "../../../src/cache/cacheHolder.js";

describe("AbapRepository", () => {
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
    beforeEach(async () => {
        sandbox = sinon.createSandbox();
        CacheHolder.clear();
    });
    afterEach(() => sandbox.restore());

    it("should return map of files from archive", async () => {
        const { abapRepository, calls } = await prepareServiceStubs(RESPONSE_DATA);
        const baseAppFiles = await abapRepository.fetch({ appName: "app/Name", cacheBusterToken: Promise.resolve("token123") });
        expect([...baseAppFiles.keys()]).to.have.members(["i18n.properties", "manifest.json"]);
        expect(calls.ui5AbapRepositoryProps).to.eql("/Repositories('app%2FName')");
    });

    it("should throw exception when archive is empty", async () => {
        const responseClone = JSON.parse(RESPONSE_DATA.data);
        responseClone.d.ZipArchive = "";
        const { abapRepository } = await prepareServiceStubs({ data: JSON.stringify(responseClone) });
        await expect(abapRepository.fetch({ appName: "app/Name", cacheBusterToken: Promise.resolve("token123") }))
            .to.be.rejectedWith("App 'app/Name' doesn't contain files");
    });

    async function prepareServiceStubs(abapRepositoryResponse: any) {
        const calls = {
            ui5AbapRepositoryProps: ""
        };
        const AbapRepository = await mockAbapRepository({ abapRepositoryResponse, calls });
        const abapRepository = new AbapRepository(options.configuration);
        return { abapRepository, calls };
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
            const AbapRepository = await mockAbapRepository({
                lrepResponse: {
                    status: 200,
                    data: JSON.stringify(appVariantIdHierarchyJson)
                }
            });
            const abapRepository = new AbapRepository(options.configuration);
            const appVariantIdHierarchy = await abapRepository.getAppVariantIdHierarchy("baseApp1");
            const actual = await Promise.all(appVariantIdHierarchy.map(async (item) => ({ ...item, cacheBusterToken: await item.cacheBusterToken })));
            expect(actual).eql([{
                appName: "APP_VAR_1",
                cacheBusterToken: "~3B9623C59A5D02FAC13300DA1D98A0CD~5",
            }]);
        });
        it("should fallback to metadata and configuration (has appName)", async () => {
            const AbapRepository = await mockAbapRepository({
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
            const abapRepository = new AbapRepository(options.configuration);
            let appVariantIdHierarchy = await abapRepository.getAppVariantIdHierarchy("appVar1");
            const actual = await Promise.all(appVariantIdHierarchy.map(async (item) => ({ ...item, cacheBusterToken: await item.cacheBusterToken })));
            expect(actual).eql([{
                appName: "app/Name",
                cacheBusterToken: "010101",
            }]);
        });
    });
});

async function mockAbapRepository({ abapRepositoryResponse, lrepResponse, appIndexResponse, calls }: any): Promise<typeof AbapRepository> {
    return esmock("../../../src/repositories/abapRepository.js", {}, {
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
