import { expect } from "chai";
import UpdateCloudPlatformCommand from "../../../../src/adapters/commands/updateCloudPlatformCommand.js";

describe("UpdateCloudPlatformCommand", () => {
    it("should not update oAuthScopes if empty", async () => {
        const manifest = { "sap.platform.cf": {} };
        new UpdateCloudPlatformCommand(undefined).execute(manifest);
        expect(manifest["sap.platform.cf"]).to.be.empty;
    });

    it("should not update oAuthScopes if no sap.platform.cf", async () => {
        const manifest = {} as any;
        new UpdateCloudPlatformCommand(undefined).execute(manifest);
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
        new UpdateCloudPlatformCommand(undefined).execute(manifest);
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
        new UpdateCloudPlatformCommand(undefined).execute(manifest);
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
        new UpdateCloudPlatformCommand(undefined).execute(manifest);
        expect(manifest["sap.platform.cf"].oAuthScopes[0]).to.eql("scope1");
    });

    it("should update sap.cloud", async () => {
        const manifest = {
            "sap.cloud": {
                service: "testService"
            }
        };
        new UpdateCloudPlatformCommand("sapCloudService1").execute(manifest);
        expect(manifest["sap.cloud"].service).to.eql("sapCloudService1");
    });

    it("should create sap.cloud", async () => {
        const manifest = {} as any;
        new UpdateCloudPlatformCommand("sapCloudService1").execute(manifest);
        expect(manifest["sap.cloud"].service).to.eql("sapCloudService1");
    });

    it("should delete sap.cloud", async () => {
        const manifest = {
            "sap.cloud": {
                service: "testService"
            }
        };
        new UpdateCloudPlatformCommand(undefined).execute(manifest);
        expect(manifest["sap.cloud"]).to.be.undefined
    });
});
