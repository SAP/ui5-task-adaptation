import * as fs from "fs";
import * as fsPromises from "fs/promises";
import * as path from "path";
import * as os from "node:os";

import ResourceUtil from "../util/resourceUtil.js";
import encodeFilename from "filenamify";
import { getLogger } from "@ui5/logger";
import ICachedResource from "./cachedResource.js";

const log = getLogger("@ui5/task-adaptation::CacheHolder");

export default class CacheHolder {

    private static TEMP_TASK_DIR = "ui5-task-adaptation";
    private static MERGED_DIR = "merged";

    static getTempDir(...paths: string[]) {
        return path.join(os.tmpdir(), this.TEMP_TASK_DIR, ...paths.map(part => encodeFilename(part, { replacement: "_" })));
    }


    static async hasDirectory(resource: ICachedResource) {
        const directory = this.getTempDir(resource.appName, await resource.token);
        return fs.existsSync(directory);
    }


    static async read(resource: ICachedResource): Promise<Map<string, Buffer>> {
        const directory = this.getTempDir(resource.appName, await resource.token);
        if (!await this.hasDirectory(resource)) {
            log.verbose(`No cache directory '${directory}' found`);
            return new Map<string, Buffer>();
        }
        return ResourceUtil.byGlob(directory, "**/*");
    }


    static async write(resource: ICachedResource, files: Map<string, Buffer>): Promise<void> {
        const token = await resource.token;
        if (resource.appName == null || token == null) {
            log.verbose(`No 'appName' or 'token' provided, skipping cache write`);
            return;
        }
        if (!resource.keepAppNameDir) {
            this.delete(resource.appName);
        } else {
            this.delete(resource.appName, token);
        }
        await ResourceUtil.write(this.getTempDir(resource.appName, token), files);
    }


    static mergedResource(reference: string): ICachedResource {
        return { appName: reference, token: Promise.resolve(this.MERGED_DIR), keepAppNameDir: true };
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
            const cachedResource = args[0] as ICachedResource;
            let files = await CacheHolder.read(cachedResource);
            const appName = cachedResource.appName;
            const token = await cachedResource.token;
            CacheHolder.clearOutdatedExcept(appName);
            if (files.size === 0) {
                log.verbose(`No cache for repo '${appName}' with token '${token}'. Fetching from repository.`);
                files = await originalValue.apply(this, args);
                await CacheHolder.write(cachedResource, files!);
            } else {
                log.verbose(`Using cached files for repo '${appName}' with token '${token}'.`);
            }
            return files;
        };
    };
}
