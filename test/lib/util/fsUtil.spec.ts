import { posix as path } from "node:path";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as chai from "chai";
import chaiAsPromised from "chai-as-promised";
import FsUtil from "../../../src/util/fsUtil.js";

chai.use(chaiAsPromised);
const { expect } = chai;

async function withTempCwd(run: (tmp: string) => Promise<void> | void): Promise<void> {
    const originalCwd = process.cwd();
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ui5-task-adaptation-test-"));
    try {
        process.chdir(tmp);
        await run(tmp);
    } finally {
        process.chdir(originalCwd);
        // best-effort cleanup; ignore errors on Windows file locks
        try {
            await fs.rm(tmp, { recursive: true, force: true });
        } catch {
            /* noop */
        }
    }
}


describe("FsUtil.readInProject", () => {
    it("reads a file from current project root", async () => {
        await withTempCwd(async (temp) => {
            const filename = "ui5AppInfo.json";
            const content = "{\"ok\":true}";
            await fs.writeFile(path.join(temp, filename), content);
            expect(await FsUtil.readInProject(filename)).to.equal(content);
        });
    });

    it("throws custom error when not in project root (no ui5.yaml)", async () => {
        await withTempCwd(async () => {
            await expect(FsUtil.readInProject("missing.json"))
                .to.be.rejectedWith(Error, /make sure that build has been started from the project root/);
        });
    });

    it("rethrows ENOENT when ui5.yaml exists in project root", async () => {
        await withTempCwd(async (tmp) => {
            await fs.writeFile(path.join(tmp, "ui5.yaml"), "specVersion: '3.0'");
            await expect(FsUtil.readInProject("missing.json"))
                .to.be.rejectedWith(Error, /ENOENT/);
        });
    });
});
