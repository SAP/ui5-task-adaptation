import { expect } from "chai";
import FetchEndpointsCommand from "../../../../src/adapters/commands/fetchEndpointsCommand.js";
import CFUtil from "../../../../src/util/cfUtil.js";
import sinon, { SinonSandbox } from "sinon";

describe("getServiceInstanceKeys direct unit tests", () => {
    let sandbox: SinonSandbox;
    beforeEach(() => sandbox = sinon.createSandbox());
    afterEach(() => sandbox.restore());

    it("should throw error when serviceInstanceName is not provided", async () => {
        const command = new FetchEndpointsCommand({
            appName: "test-app"
            // serviceInstanceName is missing
        });
        await expect(command.execute())
            .to.be.rejectedWith("'serviceInstanceName' should be specified in ui5.yaml configuration");
    });

    it("should throw error when CFUtil.getOrCreateServiceKeyWithEndpoints fails", async () => {
        sandbox.stub(CFUtil, "getOrCreateServiceKeyWithEndpoints").rejects(new Error("Service not found"));
        const command = new FetchEndpointsCommand({
            appName: "test-app",
            space: "test-space",
            serviceInstanceName: "test-service-instance"
        });
        await command.execute();
        await expect(command.result)
            .to.be.rejectedWith("Failed to get a service key with endpoints for service instance 'test-service-instance' in space 'test-space': Service not found");
    });
});
