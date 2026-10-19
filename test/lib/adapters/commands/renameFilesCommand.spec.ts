import { expect } from "chai";
import RenameFilesCommand from "../../../../src/adapters/commands/renameFilesCommand.js";
import { toBuffer } from "../../testUtilities/testUtil.js";

// RenameFilesCommand is a thin PostCommand wrapper around Renamer (see
// renamer.spec.ts for the full renaming behavior). This verifies the command
// delegates renaming to it.
describe("RenameFilesCommand", () => {
    it("should delegate renaming to Renamer when executed", async () => {
        const files = new Map<string, Buffer>([
            ["manifest.json", toBuffer(JSON.stringify({ "sap.app": { "id": "my.app" } }))]
        ]);
        const references = new Map<string, string>([["my.app", "customer.app"]]);

        await new RenameFilesCommand(references).execute(files);

        const manifest = JSON.parse(files.get("manifest.json")!.toString("utf8"));
        expect(manifest["sap.app"].id).to.equal("customer.app");
    });
});
