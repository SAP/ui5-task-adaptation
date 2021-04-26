import * as fs from "fs";
import * as path from "path";
import * as rimraf from "rimraf";

import { IConfiguration } from "../model/types";

const tempFolder = require('temp-dir');
const resourceFactory = require("@ui5/fs/lib/resourceFactory");

export default class ResourceUtil {

    public static METADATA_FILENAME = "html5metadata.json";

    static readTempMetadata(configuration: IConfiguration): any {
        const baseAppTempFolder = this.getBaseAppTempFolder(configuration);
        const metadataPath = path.resolve(baseAppTempFolder, this.METADATA_FILENAME);
        if (fs.existsSync(metadataPath)) {
            return JSON.parse(fs.readFileSync(metadataPath, { encoding: "utf-8" }));
        }
    }


    static getRootFolder(projectNamespace?: string) {
        const newPath = ["/resources"];
        if (projectNamespace) {
            newPath.push(projectNamespace);
        }
        return path.join(...newPath);
    }


    static writeTemp(configuration: IConfiguration, files: Map<string, string>): Promise<void[]> {
        const distTempFolder = this.getBaseAppTempFolder(configuration);
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


    static async readTemp(configuration: IConfiguration): Promise<Map<string, string>> {
        const baseAppTempFolder = this.getBaseAppTempFolder(configuration);
        const baseAppFiles = new Map<string, string>();
        if (fs.existsSync(baseAppTempFolder)) {
            this.fetchFiles(baseAppTempFolder, baseAppTempFolder, baseAppFiles);
        }
        return baseAppFiles;
    }


    private static getBaseAppTempFolder(configuration: IConfiguration) {
        return path.join(tempFolder, this.getTempId(configuration));
    }


    private static getTempId({ appHostId, appName, appVersion }: IConfiguration) {
        return this.normalizeId(`ui5-task-adaptation-${appHostId}-${appName}-${appVersion}`);
    }


    static deleteTemp(configuration: IConfiguration): void {
        rimraf.sync(this.getBaseAppTempFolder(configuration));
    }


    private static normalizeId(id: string) {
        return id.replace(/\/\\/g, "_");
    }


    static fetchFiles(rootFolder: string, folder: string, baseAppFiles: Map<string, string>) {
        const entries = fs.readdirSync(folder);
        for (let entry of entries) {
            const entryPath = path.join(folder, entry);
            const stats = fs.lstatSync(entryPath);
            if (stats.isFile() && !entryPath.endsWith(this.METADATA_FILENAME)) {
                const normalized = entryPath.substring(rootFolder.length);
                baseAppFiles.set(normalized, fs.readFileSync(entryPath, { encoding: "utf-8" }));
            } else if (stats.isDirectory()) {
                this.fetchFiles(rootFolder, entryPath, baseAppFiles);
            }
        }
    }

}