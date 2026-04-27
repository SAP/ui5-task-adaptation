import IRepository from "./repository.js";
import { getLogger } from "@ui5/logger";
import path from "node:path";
import fs from "node:fs/promises";
import FsUtil from "../util/fsUtil.js";
import ICachedResource from "../cache/cachedResource.js";

const log = getLogger("@ui5/task-adaptation::LocalRepository");


export interface ILocalResource extends ICachedResource {
    absolutePath: string;
}


export default class LocalRepository implements IRepository {

    async downloadAnnotationFile(_uri: string): Promise<Map<string, string>> {
        log.verbose("Downloading annotation files is not supported in LocalRepository.");
        return new Map<string, string>();
    }


    async getAppVariantIdHierarchy(appId: string): Promise<ILocalResource[]> {
        const items: ILocalResource[] = [];
        await this.collectAppVariantIdHierarchyItems(appId, items);
        return items;
    }


    fetch(resource: ILocalResource): Promise<Map<string, string>> {
        log.verbose(`Fetching base app files from local directory: ${resource.absolutePath}`);
        return FsUtil.readFilesRecursively(resource.absolutePath);
    }


    private async collectAppVariantIdHierarchyItems(appId: string, items: ILocalResource[]): Promise<void> {
        const appDir = this.getLocalFilesDirectory(appId);
        const filenames = [
            { path: ["webapp", "manifest.json"], suffix: "" },
            { path: ["webapp", "manifest.appdescr_variant"], suffix: "" },
            { path: ["manifest.json"], suffix: "-opt-static-abap" },
            { path: ["manifest.appdescr_variant"], suffix: "-opt-static-abap" },
        ];
        const filepaths = filenames.map((filename) => path.join(appDir + filename.suffix, ...filename.path));

        const existingManifestPath = await this.getExistingManifestPath(filepaths);
        items.push({
            appName: appId,
            cacheBusterToken: Promise.resolve("local"),
            absolutePath: path.dirname(existingManifestPath),
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


    private getLocalFilesDirectory(appId: string): string {
        const adpDirConfigured = process.env.ADP_BUILDER_DIR
        const adpDir = adpDirConfigured
            ? path.normalize(adpDirConfigured).replace(/\\/g, "/").replace(/\/+$/, "").split("/")
            : [".."];
        return path.join(process.cwd(), ...adpDir, appId);
    }
}
