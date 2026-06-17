import IRepository from "./repository.js";
import { getLogger } from "@ui5/logger";
import path from "node:path";
import fs from "node:fs/promises";
import { glob } from "glob";
import FsUtil from "../util/fsUtil.js";
import ICachedResource from "../cache/cachedResource.js";

const log = getLogger("@ui5/task-adaptation::LocalRepository");


export interface ILocalResource extends ICachedResource {
    absolutePath: string;
}


interface ManifestEntry {
    absolutePath: string;
    isVariant: boolean;
    reference?: unknown;
}


export default class LocalRepository implements IRepository {

    async downloadAnnotationFile(_uri: string): Promise<Map<string, string>> {
        log.verbose("Downloading annotation files is not supported in LocalRepository.");
        return new Map<string, string>();
    }


    async getAppVariantIdHierarchy(appId: string): Promise<ILocalResource[]> {
        const items: ILocalResource[] = [];
        const baseDir = this.getLocalFilesDir();
        const index = await this.buildManifestIndex(baseDir);

        const visited = new Set<string>();
        let currentAppId: string | undefined = appId;
        while (currentAppId) {
            if (visited.has(currentAppId)) {
                throw new Error(`Cycle detected in app variant hierarchy: '${currentAppId}' was already visited. Visited IDs: ${[...visited].join(" -> ")} -> ${currentAppId}`);
            }
            visited.add(currentAppId);
            const entry = index.get(currentAppId);
            if (!entry) {
                throw new Error(`App '${currentAppId}' not found in local directory '${baseDir}'.`);
            }
            items.push({
                appName: currentAppId,
                cacheBusterToken: Promise.resolve("local"),
                absolutePath: entry.absolutePath,
            });
            if (entry.isVariant) {
                if (!entry.reference || typeof entry.reference !== "string") {
                    throw new Error(`Invalid or missing 'reference' for app variant '${currentAppId}': expected a non-empty string but got '${entry.reference}'`);
                }
                currentAppId = entry.reference;
            } else {
                currentAppId = undefined;
            }
        }

        return items;
    }


    fetch(resource: ILocalResource): Promise<Map<string, Buffer>> {
        log.verbose(`Fetching base app files from local directory: ${resource.absolutePath}`);
        return FsUtil.readFilesRecursively(resource.absolutePath);
    }


    private async buildManifestIndex(baseDir: string): Promise<Map<string, ManifestEntry>> {
        const index = new Map<string, ManifestEntry>();
        const manifestPaths = await glob("**/manifest.{json,appdescr_variant}", { cwd: baseDir, absolute: true, dot: true });

        for (const manifestPath of manifestPaths) {
            const content = await fs.readFile(manifestPath, "utf-8");
            const manifest = JSON.parse(content);
            const isVariant = manifestPath.endsWith("manifest.appdescr_variant");
            const id = isVariant ? manifest.id : manifest["sap.app"]?.id;
            if (typeof id === "string" && id) {
                index.set(id, {
                    absolutePath: path.dirname(manifestPath),
                    reference: manifest.reference,
                    isVariant,
                });
            }
        }

        return index;
    }


    private getLocalFilesDir(): string {
        const adpDirConfigured = process.env.ADP_BUILDER_DIR
        if (adpDirConfigured && path.isAbsolute(adpDirConfigured)) {
            return path.normalize(adpDirConfigured);
        }
        const adpDir = adpDirConfigured
            ? path.normalize(adpDirConfigured).replace(/\\/g, "/").replace(/\/+$/, "").split("/")
            : [".."];
        return path.join(process.cwd(), ...adpDir);
    }
}
