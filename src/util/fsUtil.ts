import fs from "fs/promises";
import path from "path";


export default class FsUtil {
    /*
     * Read the file by filepath from the project root (folder where 'webapp',
     * 'package.json', 'ui5.yaml' located). 
     * @param filepath The relative file path from the project root (e.g. 'ui5AppInfo.json').
     * @returns A promise that resolves to the file content as a string.
     */
    static async readInProject(filepath: string): Promise<string> {
        try {
            return await fs.readFile(path.join(process.cwd(), filepath), "utf-8");
        } catch (error: any) {
            const isProjectRoot = await FsUtil.fileExists(path.join(process.cwd(), "ui5.yaml"));
            if (!isProjectRoot) {
                throw new Error(`Please make sure that build has been started from the project root: ${error?.message ?? ""}`);
            }
            throw error;
        }
    }


    /**
     * Check whether a file or directory exists (non-throwing).
     * @param filePath Absolute or relative path
     * @returns true if the path exists, false if not
     */
    private static async fileExists(filePath: string): Promise<boolean> {
        try {
            await fs.access(filePath);
            return true;
        } catch (e: any) {
            if (e?.code === "ENOENT") {
                return false;
            }
            throw e;
        }
    }
}
