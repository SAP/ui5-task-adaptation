import * as chai from "chai";
import * as sinon from "sinon";
import PreviewAdapter from "../../../src/adapters/previewAdapter.js";
import CFUtil from "../../../src/util/cfUtil.js";

const { expect } = chai;

describe("PreviewAdapter", () => {
    let sandbox: sinon.SinonSandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    it("should enhance xs-app.json routes with endpoint and service", async () => {
        const adapter = new PreviewAdapter({
            serviceInstanceName: "my-service",
            appName: "my-app",
            space: "my-space"
        });

        sandbox.stub(CFUtil, "getOrCreateServiceKeyWithEndpoints").resolves({
            endpoints: {
                "api-endpoint": {
                    destination: "ZTEST_DEST"
                }
            },
            "sap.cloud.service": "test-service"
        });

        const files = new Map<string, string>([
            ["xs-app.json", JSON.stringify({
                routes: [{
                    source: "^/sap/opu/odata/sap/ZTEST_SRV/",
                    target: "/sap/opu/odata/sap/ZTEST_SRV/",
                    authenticationType: "basic",
                    destination: "OVERRIDE"
                }, {
                    source: "^/sap/opu/odata/sap/ZTEST_SRV/",
                    target: "/sap/opu/odata/sap/ZTEST_SRV/",
                    authenticationType: "none",
                    destination: "ZTEST_DEST"
                }]
            })]
        ]);

        const postCommandChain = adapter.createPostCommandChain();
        const enhancedFiles = await postCommandChain.execute(files);
        const xsAppJson = JSON.parse(enhancedFiles.get("xs-app.json")!);

        expect(xsAppJson.routes).to.deep.equal([{
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
    });
});
