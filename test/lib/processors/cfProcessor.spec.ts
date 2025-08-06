/* eslint-disable @typescript-eslint/no-unused-expressions */
import { expect } from "chai";
import CFProcessor from "../../../src/processors/cfProcessor.js";

describe("CFProcessor", () => {

    it("should not update oAuthScopes if empty", async () => {
        const manifest = { "sap.platform.cf": {} };
        await new CFProcessor({}).updateLandscapeSpecificContent(manifest);
        expect(manifest["sap.platform.cf"]).to.be.empty;
    });

    it("should not update oAuthScopes if no sap.platform.cf", async () => {
        const manifest = {} as any;
        await new CFProcessor({}).updateLandscapeSpecificContent(manifest);
        expect(manifest["sap.platform.cf"]).to.be.undefined;
    });

    it("should update oAuthScopes if having $XSAPPNAME.", async () => {
        const manifest = {
            "sap.platform.cf": {
                oAuthScopes: [
                    "$XSAPPNAME.scope1"
                ]
            },
            "sap.cloud": {
                service: "testService"
            }
        };
        await new CFProcessor({}).updateLandscapeSpecificContent(manifest);
        expect(manifest["sap.platform.cf"].oAuthScopes[0]).to.eql("$XSAPPNAME('testService').scope1");
    });

    it("should not update oAuthScopes if not having sap.cloud/service", async () => {
        const manifest = {
            "sap.platform.cf": {
                oAuthScopes: [
                    "$XSAPPNAME.scope1"
                ]
            }
        };
        await new CFProcessor({}).updateLandscapeSpecificContent(manifest);
        expect(manifest["sap.platform.cf"].oAuthScopes[0]).to.eql("$XSAPPNAME.scope1");
    });

    it("should not update oAuthScopes if not having $XSAPPNAME.", async () => {
        const manifest = {
            "sap.platform.cf": {
                oAuthScopes: [
                    "scope1"
                ]
            },
            "sap.cloud": {
                service: "testService"
            }
        };
        await new CFProcessor({}).updateLandscapeSpecificContent(manifest);
        expect(manifest["sap.platform.cf"].oAuthScopes[0]).to.eql("scope1");
    });

    it("should update sap.cloud", async () => {
        const manifest = {
            "sap.cloud": {
                service: "testService"
            }
        };
        await new CFProcessor({ sapCloudService: "sapCloudService1" }).updateLandscapeSpecificContent(manifest);
        expect(manifest["sap.cloud"].service).to.eql("sapCloudService1");
    });

    it("should create sap.cloud", async () => {
        const manifest = {} as any;
        await new CFProcessor({ sapCloudService: "sapCloudService1" }).updateLandscapeSpecificContent(manifest);
        expect(manifest["sap.cloud"].service).to.eql("sapCloudService1");
    });

    it("should delete sap.cloud", async () => {
        const manifest = {
            "sap.cloud": {
                service: "testService"
            }
        };
        await new CFProcessor({}).updateLandscapeSpecificContent(manifest);
        expect(manifest["sap.cloud"]).to.be.undefined
    });

});
