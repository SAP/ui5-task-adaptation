import * as chai from "chai";

import { moveFile } from "../../../../src/util/movingHandler/changeFileMoveHandler.js";

const { expect } = chai;

describe("changeFileMoveHandler moveFile", () => {

    it("moves manifest change files and records renaming path", () => {
        const filename = "changes/appdescr_ui5.change";
        const content = JSON.stringify({ changeType: "appdescr_appTitle" });
        const prefix = "app_var_id1";
        const id = "customer_app_variant1";

        const result = moveFile(filename, content, prefix, id);

        expect(result.newFilename).to.equal("changes/app_var_id1/appdescr_ui5.change");
        expect(Array.from(result.renamingPath.entries())).to.deep.equal([
            ["appdescr_ui5", "app_var_id1/appdescr_ui5"]
        ]);
    });

    it("moves change js files and namespaces controller extensions", () => {
        const filename = "changes/coding/Fix.js";
        const content = "ControllerExtension.extend(\"customer_app_variant1.ext.MyExt\")";
        const prefix = "app_var_id1";
        const id = "customer_app_variant1";

        const result = moveFile(filename, content, prefix, id);

        expect(result.newFilename).to.equal("changes/app_var_id1/coding/Fix.js");
        
        expect(Array.from(result.renamingPath.entries())).to.deep.equal([
            ["coding/Fix", "app_var_id1/coding/Fix"],
            ["customer_app_variant1.ext.MyExt", "customer_app_variant1.app_var_id1.ext.MyExt"]
        ]);
    });

});
