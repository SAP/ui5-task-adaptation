import * as sinon from "sinon";
import fs from "fs/promises";
import os from "node:os";
import path from "path";
import { expect } from "chai";
import AbapProvider from "../../../src/repositories/abapProvider.js";
import AbapRepository from "../../../src/repositories/abapRepository.js";
import AbapAnnotationManager from "../../../src/annotations/abapAnnotationManager.js";
import { IConfiguration } from "../../../src/model/configuration.js";
import { metadataV4Xml } from "../testUtilities/testUtil.js";

describe("Annotation debug files", () => {
    let sandbox: sinon.SinonSandbox;
    let projectDir: string;
    let debugDir: string;
    let get: sinon.SinonStub;
    let provider: AbapProvider;

    beforeEach(async () => {
        sandbox = sinon.createSandbox();
        projectDir = await fs.mkdtemp(path.join(os.tmpdir(), "adp-annotation-debug-"));
        debugDir = path.join(projectDir, ".adp/debug/annotations");
        sandbox.stub(process, "cwd").returns(projectDir);
        get = sandbox.stub();
        provider = new AbapProvider();
        sandbox.stub(provider, "get").resolves({ get } as any);
    });

    afterEach(async () => {
        sandbox.restore();
        await fs.rm(projectDir, { recursive: true, force: true });
    });

    for (const enableDebug of [undefined, false]) {
        it(`should not create debug files when enableDebug is ${enableDebug}`, async () => {
            const xml = metadataV4Xml("");
            get.resolves({ data: xml });
            const repository = new AbapRepository({ enableDebug }, provider);

            expect(await repository.downloadAnnotationFile("/service/$metadata?sap-language=EN")).to.equal(xml);
            expect(await fs.readdir(projectDir)).to.eql([]);
        });
    }

    it("should save raw metadata, annotations and references for every configured language", async () => {
        const configuration: IConfiguration = {
            enableDebug: true,
            languages: [
                { sap: "EN", i18n: "en" },
                { sap: "DE", i18n: "de" },
                { sap: "ZF", i18n: "zh_TW" }
            ]
        };
        const responses = new Map<string, string>();
        for (const [language, label] of [["EN", "Name"], ["DE", "Bezeichnung"], ["ZF", "名稱"]]) {
            const annotation = `<Annotations Target="Service.Entity"><Annotation Term="com.sap.vocabularies.Common.v1.Label" String="${label}"/></Annotations>`;
            const reference = '<edmx:Reference Uri="/service/child.xml"><edmx:Include Namespace="Child"/></edmx:Reference>';
            const vocabulary = '<edmx:Reference Uri="/vocabularies/Common.xml"><edmx:Include Namespace="com.sap.vocabularies.Common.v1" Alias="Common"/></edmx:Reference>';
            responses.set(`/service/$metadata?sap-language=${language}`, metadataV4Xml(reference, annotation));
            responses.set(`/service/child.xml?sap-language=${language}`, metadataV4Xml(vocabulary, annotation));
            responses.set(`/service/annotation.xml?sap-language=${language}`, metadataV4Xml(vocabulary, annotation));
        }
        get.callsFake(async (uri: string) => {
            expect(responses.has(uri), `Unexpected request: ${uri}`).to.equal(true);
            return { data: responses.get(uri) };
        });
        const repository = new AbapRepository(configuration, provider);
        const manager = new AbapAnnotationManager(configuration, repository);
        const manifest = {
            "sap.app": {
                dataSources: {
                    mainService: { type: "OData", uri: "/service/", settings: { annotations: ["labels"] } },
                    labels: { type: "ODataAnnotation", uri: "/service/annotation.xml" }
                }
            }
        };

        const files = await manager.process(manifest, "app.variant", "prefix");

        const saved = await readDebugFiles();
        expect(saved.size).to.equal(responses.size);
        expect([...saved.values()]).to.have.members([...responses.values()]);
        for (const language of ["EN", "DE", "ZF"]) {
            expect([...saved.keys()].filter(name => name.includes(`sap-language=${language}`))).to.have.length(3);
        }
        expect(get.callCount).to.equal(responses.size);
        expect([...files.keys()].filter(name => name.startsWith("annotations/"))).to.have.members([
            "annotations/annotation_mainService.xml",
            "annotations/annotation_labels.xml"
        ]);
        expect([...files.keys()].some(name => name.includes(".adp"))).to.equal(false);
    });

    it("should keep distinct URLs separate when filenames are sanitized or truncated", async () => {
        const uris = [
            "/service/a:b?sap-language=EN",
            "/service/a*b?sap-language=EN",
            `/service/${"a".repeat(200)}/$metadata?sap-language=EN`,
            `/service/${"a".repeat(200)}/$metadata?sap-language=DE`
        ];
        get.callsFake(async (uri: string) => ({ data: `<xml>${uri}</xml>` }));
        const repository = new AbapRepository({ enableDebug: true }, provider);

        await Promise.all(uris.map(uri => repository.downloadAnnotationFile(uri)));

        const saved = await readDebugFiles();
        expect([...saved.values()]).to.have.members(uris.map(uri => `<xml>${uri}</xml>`));
        for (const filename of saved.keys()) {
            expect(filename).to.match(/.xml$/);
            expect(filename).not.to.match(/[<>:"/\\|?*]/);
            expect(filename.length).to.be.lessThan(256);
        }
    });

    it("should overwrite the same request's debug file with its latest raw response", async () => {
        const uri = "/service/$metadata?sap-language=EN";
        get.onFirstCall().resolves({ data: "<old/>" });
        // Preserve even malformed XML so conversion failures can be investigated.
        get.onSecondCall().resolves({ data: "<incomplete" });
        const repository = new AbapRepository({ enableDebug: true }, provider);

        await repository.downloadAnnotationFile(uri);
        expect(await repository.downloadAnnotationFile(uri)).to.equal("<incomplete");

        expect([...(await readDebugFiles()).values()]).to.eql(["<incomplete"]);
    });

    it("should not create a debug directory for an empty response", async () => {
        get.resolves({ data: "" });
        const repository = new AbapRepository({ enableDebug: true }, provider);

        expect(await repository.downloadAnnotationFile("/service/$metadata?sap-language=EN")).to.equal("");
        expect(await fs.readdir(projectDir)).to.eql([]);
    });

    async function readDebugFiles(): Promise<Map<string, string>> {
        const filenames = await fs.readdir(debugDir);
        return new Map(await Promise.all(filenames.map(async filename =>
            [filename, await fs.readFile(path.join(debugDir, filename), "utf8")] as const)));
    }
});
