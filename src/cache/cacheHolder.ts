import * as fs from "fs";
import * as fsPromises from "fs/promises";
import * as path from "path";
import * as os from "node:os";

import ResourceUtil from "../util/resourceUtil.js";
import encodeFilename from "filenamify";
import { getLogger } from "@ui5/logger";

const log = getLogger("@ui5/task-adaptation::CacheHolder");

export default class CacheHolder {

    private static TEMP_TASK_DIR = "ui5-task-adaptation";

    private static getTempDir(...paths: string[]) {
        return path.join(os.tmpdir(), this.TEMP_TASK_DIR, ...paths.map(part => encodeFilename(part, { replacement: "_" })));
    }

    static read(repoName: string, token: string): Promise<Map<string, string>> {
        const directory = this.getTempDir(repoName, token);
        if (this.isValid(repoName, "repoName") && this.isValid(token, "token") && fs.existsSync(directory)) {
            return ResourceUtil.byGlob(directory, "**/*");
        }
        return Promise.resolve(new Map<string, string>());
    }

    static async write(repoName: string, token: string, files: Map<string, string>): Promise<void> {
        this.delete(repoName);
        if (this.isValid(repoName, "repoName") && this.isValid(token, "token")) {
            await ResourceUtil.write(this.getTempDir(repoName, token), files);
        }
    }

    private static isValid(value: string, name: string) {
        if (value == null || value === "") {
            log.warn(`No '${name}' provided, skipping cache write`);
            return false;
        }
        return true;
    }

    /**
     * Clears cached files by repo name and token
     */
    static delete(...paths: string[]) {
        this.deleteDir(this.getTempDir(...paths));
    }

    /**
     * Clears all cached files
     */
    static clear() {
        this.deleteDir(path.join(os.tmpdir(), this.TEMP_TASK_DIR));
    }

    private static deleteDir(directory: string) {
        if (fs.existsSync(directory)) {
            fs.rmSync(directory, { recursive: true, force: true });
        }
    }

    static async clearOutdatedExcept(repoName?: string, maxAgeMs: number = 1000 * 60 * 60 * 24 * 30) {
        const MAX_AGE = Date.now() - maxAgeMs; // 30 days by default
        const directory = this.getTempDir();
        if (!fs.existsSync(directory)) {
            return;
        }
        const entries = await fsPromises.readdir(directory);
        for (let entry of entries) {
            const repoCacheDirectory = path.join(directory, entry);
            const stats = await fsPromises.lstat(repoCacheDirectory);
            if (stats.isDirectory() && stats.ctimeMs < MAX_AGE && (!repoName || entry !== encodeFilename(repoName))) {
                await fsPromises.rm(repoCacheDirectory, { recursive: true, force: true });
            }
        }
    }
}


export function cached() {
    return function (_target: any, _propertyKey: string, descriptor: PropertyDescriptor) {
        const originalValue = descriptor.value
        descriptor.value = async function (...args: any[]) {
            const repoName = args[0];
            const cachebusterToken = args[1];
            let files = await CacheHolder.read(repoName, cachebusterToken);
            CacheHolder.clearOutdatedExcept(repoName);
            if (files.size === 0) {
                log.verbose(`No cache for repo '${repoName}' with token '${cachebusterToken}'. Fetching from HTML5 Repository.`);
                files = await originalValue.apply(this, args);
                await CacheHolder.write(repoName, cachebusterToken, files!);
            } else {
                log.verbose(`Using cached files for repo '${repoName}' with token '${cachebusterToken}'.`);
            }
            return files;
        };
    };
}
