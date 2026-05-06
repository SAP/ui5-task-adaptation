import { expect } from "chai";
import { SinonSandbox } from "sinon";
import FsUtil from "../../../../src/util/fsUtil.js";
import sinon from "sinon";
import FetchPreviewResourcesCommand from "../../../../src/adapters/commands/fetchPreviewResourcesCommand.js";
import ResourceUtil from "../../../../src/util/resourceUtil.js";
import ProcessPreviewResourcesCommand from "../../../../src/adapters/commands/processPreviewResourcesCommand.js";
import { XsApp } from "../../../../src/util/cf/xsAppJsonUtil.js";
import { ServiceCredentials } from "../../../../src/model/types.js";
import CFUtil from "../../../../src/util/cfUtil.js";
import HTML5Repository from "../../../../src/repositories/html5Repository.js";

describe("PreviewManager adjust xs-app.json", () => {
    let sandbox: SinonSandbox;
    const reuseLib = {
        asyncHints: {
            libs: [{
                name: "com.example.lib1",
                html5AppName: "lib1",
                html5AppHostId: "ddc20001-a38e-4dd2-891c-1ad50a6a7f18",
                html5AppVersion: "1.0.0",
                html5CacheToken: "~047c74d4-75fe-4476-9353-4fd307b31a96~",
                url: {
                    final: "https://example.com/lib1"
                }
            }]
        },
        messages: []
    };

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        sandbox.stub(CFUtil, "getOrCreateServiceKeyWithEndpoints").resolves({
            endpoints: {
                "api-endpoint": {
                    destination: "ZTEST_DEST"
                }
            },
            "sap.cloud.service": "test-service"
        });
    });

    afterEach(() => sandbox.restore());

    after(() => {
        delete process.env.ADP_BUILDER_MODE;
    });

    it("should adjust source path in xs-app.json", async () => {
        sandbox.stub(FsUtil, "readInProject").resolves(JSON.stringify({ "appId": reuseLib }));
        const xsAppJson = JSON.stringify({
            "routes": [
                {
                    "source": "^/resources/(.*)$",
                    "target": "/resources/$1",
                    "authenticationType": "none"
                },
                {
                    "source": "^/test/(.*)$",
                    "target": "/test/$1",
                    "authenticationType": "none"
                }
            ]
        });
        const xsApp = await getXsAppJsonResult(sandbox, xsAppJson);
        expect(xsApp.routes).to.deep.equal([{
            "authenticationType": "none",
            "source": "^/resources/com/example/lib1/(.*)$",
            "target": "/resources/$1",
        },
        {
            "authenticationType": "none",
            "source": "^/resources/com/example/lib1/test/(.*)$",
            "target": "/test/$1",
        }]);
    });

    it("should adjust source path in xs-app.json for html5-apps-repo-rt service", async () => {
        sandbox.stub(FsUtil, "readInProject").resolves(JSON.stringify({ "appId": reuseLib }));
        const xsAppJson = JSON.stringify({
            "routes": [{
                "source": "^(.*)$",
                "target": "$1",
                "service": "html5-apps-repo-rt",
                "authenticationType": "xsuaa"
            }]
        });
        const xsApp = await getXsAppJsonResult(sandbox, xsAppJson);
        expect(xsApp.routes).to.deep.equal([{
            "localDir": ".adp/reuse/lib1",
            "source": "^/resources/com/example/lib1/(.*)$",
            "target": "$1"
        }]);
    });

    it("should merge xs-app.json files", async () => {
        sandbox.stub(FsUtil, "readInProject").resolves(JSON.stringify({ "appId": reuseLib }));
        const serviceKeyCredentials = {
            endpoints: {
                "api-endpoint": {
                    destination: "ZTEST_DEST"
                }
            },
            "sap.cloud.service": "test-service"
        } as ServiceCredentials;
        const xsAppJson = JSON.stringify({
            "authenticationMethod": "route",
            "routes": [
                {
                    "source": "^/test/(.*)$",
                    "target": "/test/$1",
                    "authenticationType": "xsuaa",
                    "destination": "ZTEST_DEST",
                },
                {
                    "source": "^(.*)$",
                    "target": "$1",
                    "service": "html5-apps-repo-rt",
                    "authenticationType": "xsuaa"
                }
            ]
        });
        const baseFiles = new Map<string, string>();
        baseFiles.set("xs-app.json", JSON.stringify({
            "authenticationMethod": "route",
            "routes": [
                {
                    "source": "^/resources/(.*)$",
                    "target": "/resources/$1",
                    "authenticationType": "none"
                }
            ]
        }));

        const ressourceWrite = sandbox.stub(ResourceUtil, "writeInProject");

        const fetchPreviewResourcesCommand = await preparePreview(sandbox, xsAppJson);
        const processPreviewResourcesCommand = new ProcessPreviewResourcesCommand(Promise.resolve(serviceKeyCredentials), fetchPreviewResourcesCommand.result);
        await processPreviewResourcesCommand.execute(baseFiles);

        expect(ressourceWrite.called, "ResourceUtil.writeInProject should be called to write merged xs-app.json").to.be.true;
        const mergedXsAppMap = ressourceWrite.getCall(0).args[1];
        const mergedXsAppJson = mergedXsAppMap.get("xs-app.json")!;
        const mergedXsApp = JSON.parse(mergedXsAppJson);

        expect(mergedXsApp.routes).to.deep.equal([{
            source: "^/resources/com/example/lib1/test/(.*)$",
            target: "/test/$1",
            authenticationType: "xsuaa",
            endpoint: "api-endpoint",
            service: "test-service",
        },
        {
            source: "^/resources/com/example/lib1/(.*)$",
            target: "$1",
            localDir: ".adp/reuse/lib1", // update localDir for html5-apps-repo-rt service
        },
        {
            source: "^/resources/(.*)$",
            target: "/resources/$1",
            authenticationType: "none",
        }]);
    });
});


async function getXsAppJsonResult(sandbox: SinonSandbox, xsAppJson: string): Promise<XsApp> {
    const command = await preparePreview(sandbox, xsAppJson);
    const promise = await command.result;
    const libFiles = await promise!.get("lib1");
    const adjustedXsAppJson = await libFiles!.get("lib1/xs-app.json");
    return JSON.parse(adjustedXsAppJson!);
}


async function preparePreview(sandbox: SinonSandbox, xsAppJson: string): Promise<FetchPreviewResourcesCommand> {
    const repository = new HTML5Repository({
        appHostId: "test-host-id",
        appName: "test-app",
        appVersion: "1.0.0"
    });
    sandbox.stub(repository, "fetch").resolves(new Map<string, string>([["xs-app.json", xsAppJson]]));
    const command = new FetchPreviewResourcesCommand("appId", repository);
    await command.execute();
    return command;
}
