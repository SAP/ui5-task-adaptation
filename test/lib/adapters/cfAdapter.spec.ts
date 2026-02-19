import * as chai from "chai";
import * as sinon from "sinon";
import CFAdapter from "../../../src/adapters/cfAdapter.js";
import { XSAPP_JSON_FILENAME } from "../../../src/util/cf/xsAppJsonUtil.js";
import CFUtil from "../../../src/util/cfUtil.js";
import BaseApp from "../../../src/baseAppManager.js";
import AppVariant from "../../../src/appVariantManager.js";

const { expect } = chai;


describe("CFAdapter", () => {
    let sandbox: sinon.SinonSandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe("xs-app.json merging and enhancement", () => {
        let mergedXsAppJson: any, enhancedXsAppJson: any;

        beforeEach(async () => {
            const adapter = new CFAdapter({ serviceInstanceName: "my-service", appName: "my-app", space: "my-space" });
            const baseXsApp = {
                welcomeFile: "/",
                authenticationMethod: "route",
                routes: [
                    { source: "^/(.*)$", target: "/$1", destination: "general" }
                ]
            };

            const variantXsApp = {
                welcomeFile: "/comfioritoolstravel/",
                authenticationMethod: "route",
                routes: [
                    { source: "^/(.*)$", target: "/$1", destination: "general-override" }
                ]
            };

            const files = new Map<string, string>([[XSAPP_JSON_FILENAME, JSON.stringify(baseXsApp)]]);
            const appVariantFiles = new Map<string, string>([[XSAPP_JSON_FILENAME, JSON.stringify(variantXsApp)]]);

            sandbox.stub(CFUtil, "getOrCreateServiceKeyWithEndpoints").resolves({
                endpoints: {
                    "api-endpoint": {
                        destination: "general-override"
                    }
                },
                "sap.cloud.service": "my-service"
            });

            const baseAppStub = sandbox.stub(BaseApp.prototype);
            const appVariantStub = {
                id: "base.app.variant",
                prefix: "customer.base.app.variant",
                getProcessedManifestChanges: sandbox.stub().returns([])
            } as unknown as AppVariant;
            const postCommandChain = adapter.createPostCommandChain();
            const mergeCommandChain = adapter.createMergeCommandChain(
                baseAppStub,
                appVariantStub
            );
            const mergedMap = await mergeCommandChain.execute(files, appVariantFiles);
            mergedXsAppJson = JSON.parse(mergedMap.get(XSAPP_JSON_FILENAME)!);
            const enhancedMap = await postCommandChain.execute(mergedMap);
            enhancedXsAppJson = JSON.parse(enhancedMap.get(XSAPP_JSON_FILENAME)!);
        });

        it("sets the variant welcomeFile", () => {
            expect(mergedXsAppJson.welcomeFile).to.equal("/comfioritoolstravel/");
        });

        it("keeps authenticationMethod as route", () => {
            expect(mergedXsAppJson.authenticationMethod).to.equal("route");
        });

        it("merges routes from variant and base", () => {
            expect(mergedXsAppJson.routes).to.deep.equal([
                {
                    source: "^/(.*)$",
                    target: "/$1",
                    destination: "general-override"
                },
                {
                    source: "^/(.*)$",
                    target: "/$1",
                    destination: "general"
                }
            ]);
        });

        it("enhances routes with service and endpoint", () => {
            expect(enhancedXsAppJson.routes).to.deep.equal([
                {
                    source: "^/(.*)$",
                    target: "/$1",
                    endpoint: "api-endpoint",
                    service: "my-service"
                },
                {
                    source: "^/(.*)$",
                    target: "/$1",
                    destination: "general"
                }
            ]);
        });
    });
});
