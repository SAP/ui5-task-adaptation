import * as processor from "../../src/processors/processor";
import * as sinon from "sinon";

import BaseAppFilesCacheManager from "../../src/cache/baseAppFilesCacheManager";
import CFProcessor from "../../src/processors/cfProcessor";
import { IProjectOptions } from "../../src/model/types";
import { SinonSandbox } from "sinon";
import TestUtil from "./../util/testUtil";
import { expect } from "chai";

const index = require("../../src/index");

const OPTIONS: IProjectOptions = {
    projectNamespace: "ns",
    configuration: {}
};

describe("Index", () => {
    let sandbox: SinonSandbox;

    beforeEach(() => sandbox = sinon.createSandbox());
    afterEach(() => sandbox.restore());

    it("should contain original files from appVariant even though they were moved", async () => {
        const baseAppFiles = new Map([["manifest.json", TestUtil.getResource("manifest.json")]]);
        await test({
            baseAppFiles,
            appVariantFolder: "appVariant1",
            expectLength: 8,
            expectIncluded: ["/resources/ns/i18n/i18n.properties"], // shouldn't be there, but unfortunately is, we'll fix it
            expectExcluded: ["/resources/ns/i18n/hugo.properties"]
        });
    });

    async function test({ baseAppFiles, appVariantFolder, expectLength, expectIncluded, expectExcluded }: ITestParams) {
        const cfProcessor = new CFProcessor({}, new BaseAppFilesCacheManager(OPTIONS.configuration));
        sandbox.stub(cfProcessor, "getBaseAppFiles").resolves(baseAppFiles);
        sandbox.stub(processor, "determineProcessor").returns(cfProcessor);
        const { workspace, taskUtil } = await TestUtil.getWorkspace(appVariantFolder, OPTIONS.projectNamespace);
        await index({ workspace, options: OPTIONS, taskUtil });
        const files = await workspace.byGlob("/**/*")
            .then((resources: any[]) => resources.map((resource: any) => resource.getPath()));
        if (expectLength) {
            expect(files.length).to.eq(expectLength);
        }
        if (expectIncluded) {
            expect(files).to.include.members(expectIncluded);
        }
        if (expectExcluded) {
            expect(files).not.to.include.members(expectExcluded);
        }
        return files;
    }
});

interface ITestParams {
    baseAppFiles: Map<string, string>;
    appVariantFolder: string;
    expectLength?: number;
    expectIncluded?: string[];
    expectExcluded?: string[];
}

