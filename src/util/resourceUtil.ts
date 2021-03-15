import * as path from "path";
import * as rimraf from "rimraf";
import * as fs from "fs";
const tempFolder = require('temp-dir');
const resourceFactory = require("@ui5/fs/lib/resourceFactory");

export default class ResourceUtil {

    static getRootFolder(projectNamespace?: string) {
        const newPath = ["/resources"];
        if (projectNamespace) {
            newPath.push(projectNamespace);
        }
        return path.join(...newPath);
    }


    static writeTemp(files: Map<string, string>, baseAppId: string): Promise<void[]> {
        const distTempFolder = this.getBaseAppTempFolder(baseAppId);
        rimraf.sync(distTempFolder);
        const fsTarget = resourceFactory.createAdapter({
            fsBasePath: distTempFolder,
            virBasePath: "/"
        });
        const promises: Promise<void>[] = [];
        files.forEach((string, filename) => {
            const resource = resourceFactory.createResource({ path: "/" + filename, string });
            promises.push(fsTarget.write(resource));
        });
        return Promise.all(promises);
    }


    static async readTemp(baseAppId: string): Promise<Map<string, string>> {
        const baseAppTempFolder = this.getBaseAppTempFolder(baseAppId);
        const baseAppFiles = new Map<string, string>();
        if (fs.existsSync(baseAppTempFolder)) {
            this.fetchFiles(baseAppTempFolder, baseAppTempFolder, baseAppFiles);
        }
        return baseAppFiles;
    }

    private static getBaseAppTempFolder(baseAppId: string) {
        return path.join(tempFolder, "baseapp_" + this.normalizeId(baseAppId));
    }


    static deleteTemp(baseAppId: string): void {
        rimraf.sync(this.getBaseAppTempFolder(baseAppId));
    }


    private static normalizeId(id: string) {
        return id.replace(/\/\\/g, "_");
    }


    static fetchFiles(rootFolder: string, folder: string, baseAppFiles: Map<string, string>) {
        const entries = fs.readdirSync(folder);
        for (let entry of entries) {
            const entryPath = path.join(folder, entry);
            const stats = fs.lstatSync(entryPath);
            if (stats.isFile()) {
                const normalized = entryPath.substring(rootFolder.length);
                baseAppFiles.set(normalized, fs.readFileSync(entryPath, { encoding: "utf-8" }));
            } else if (stats.isDirectory()) {
                this.fetchFiles(rootFolder, entryPath, baseAppFiles);
            }
        }
    }

}