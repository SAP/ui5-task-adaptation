import { IAppVariantIdHierarchyItem } from "../model/appVariantIdHierarchyItem.js";
import { IConfiguration } from "../model/configuration.js";
import { IReuseLibInfo } from "../model/types.js";
import IRepository from "./repository.js";
import { getLogger } from "@ui5/logger";
import path from "node:path";
import fs from "node:fs/promises";
import FsUtil from "../util/fsUtil.js";

const log = getLogger("@ui5/task-adaptation::LocalRepository");

export default class LocalRepository implements IRepository {

    constructor(private configuration: IConfiguration) { }


    async downloadAnnotationFile(_uri: string): Promise<Map<string, string>> {
        log.verbose("Downloading annotation files is not supported in LocalRepository.");
        return new Map<string, string>();
    }


    async getAppVariantIdHierarchy(appId: string): Promise<IAppVariantIdHierarchyItem[]> {
        const items: IAppVariantIdHierarchyItem[] = [];
        await this.collectAppVariantIdHierarchyItems(appId, items);
        return items;
    }


    fetch(appId: string, cachebusterToken: string): Promise<Map<string, string>> {
        return this.readFilesInBaseAppDir(appId, cachebusterToken);
    }


    fetchReuseLib(libName: string, cachebusterToken: string, _lib: IReuseLibInfo): Promise<Map<string, string>> {
        return this.readFilesInBaseAppDir(libName, cachebusterToken);
    }


    private async collectAppVariantIdHierarchyItems(appId: string, items: IAppVariantIdHierarchyItem[]): Promise<void> {
        const appDir = this.getLocalFilesDirectory(appId);
        const filenames = [
            ["manifest.json"],
            ["manifest.appdescr_variant"],
            ["webapp", "manifest.json"],
            ["webapp", "manifest.appdescr_variant"],
        ];
        const filepaths = filenames.map((filename) => path.join(appDir, ...filename));

        const existingManifestPath = await this.getExistingManifestPath(filepaths);
        items.push({
            appVariantId: appId,
            repoName: appId,
            cachebusterToken: path.dirname(existingManifestPath)
        });
        if (existingManifestPath.endsWith("manifest.appdescr_variant")) {
            const manifestContent = await fs.readFile(existingManifestPath, "utf-8");
            const manifest = JSON.parse(manifestContent);
            await this.collectAppVariantIdHierarchyItems(manifest.reference, items);
        }
    }


    private async getExistingManifestPath(filePaths: string[]): Promise<string> {
        const existenceChecks = await Promise.all(filePaths.map((filePath) => FsUtil.exists(filePath)));
        const existingIndex = existenceChecks.findIndex((exists) => exists);
        if (existingIndex !== -1) {
            return filePaths[existingIndex];
        }
        throw new Error(`None of the paths exist: '${filePaths.join("', '")}'.`);
    }


    private readFilesInBaseAppDir(_appId: string, cachebusterToken: string): Promise<Map<string, string>> {
        log.verbose(`Fetching base app files from local directory: ${cachebusterToken}`);
        return FsUtil.readFilesRecursively(cachebusterToken);
    }


    private getLocalFilesDirectory(appId: string): string {
        const baseDir = this.configuration.adpDir
            ? path.normalize(this.configuration.adpDir).replace(/\\/g, "/").replace(/\/+$/, "").split("/")
            : [".."];
        return path.join(process.cwd(), ...baseDir, appId);
    }
}
