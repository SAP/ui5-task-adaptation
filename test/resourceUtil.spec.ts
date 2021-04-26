import * as chai from "chai";

import { IProjectOptions } from "../src/model/types";
import ResourceUtil from "../src/util/resourceUtil";

const { expect } = chai;

describe("ResourceUtil", () => {

    const OPTIONS: IProjectOptions = {
        projectNamespace: "ns",
        configuration: {
            appHostId: "appHostId",
            appId: "appId",
            appName: "appName",
            appVersion: "appVersion",
            spaceGuid: "spaceGuid",
            orgGuid: "orgGuid",
            sapCloudService: "sapCloudService"
        }
    };

    describe("when getting root folder", () => {
        it("should return path with project namespace", () => expect(ResourceUtil.getRootFolder("projectNamespace1")).to.eql("/resources/projectNamespace1"));
        it("should return path without project namespace", () => expect(ResourceUtil.getRootFolder()).to.eql("/resources"));
    });

    describe("when writing reading base app files", () => {
        after(() => ResourceUtil.deleteTemp(OPTIONS.configuration));

        it("should return empty map for non-existing temp folder", async () => {
            const result = await ResourceUtil.readTemp(OPTIONS.configuration);
            expect(result.size).to.equal(0);
        });

        it("should return files for existing temp folder", async () => {
            const files = new Map([[`/${ResourceUtil.METADATA_FILENAME}`, `{ "some": true }`], ["/folder1/file1", "file1Content"], ["/file2", "file2Content"]]);
            await ResourceUtil.writeTemp(OPTIONS.configuration, files);
            const result = await ResourceUtil.readTemp(OPTIONS.configuration);
            expect(result.size).to.equal(2);
            expect(result.get("/folder1/file1")).to.equal("file1Content");
            expect(result.get("/file2")).to.equal("file2Content");
        });
    });

    describe("when reading metadata", () => {
        before(async () => {
            const files = new Map([[`/${ResourceUtil.METADATA_FILENAME}`, `{ "some": true }`], ["/file1", "file1Content"]]);
            await ResourceUtil.writeTemp(OPTIONS.configuration, files);
        });
        after(() => ResourceUtil.deleteTemp(OPTIONS.configuration));

        it("should return metadata", async () => {
            const result = await ResourceUtil.readTempMetadata(OPTIONS.configuration);
            expect(result.some).to.be.true;
        });
        it("should return undefined for non-existing cache", async () => {
            const result = await ResourceUtil.readTempMetadata({ ...OPTIONS.configuration, appVersion: "noAppVersion" });
            expect(result).to.be.undefined;
        });
    });

});