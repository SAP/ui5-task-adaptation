import * as fs from "fs";
import * as resourceFactory from "@ui5/fs/resourceFactory";

import { posix as path } from "path";

const UTF8 = "utf8";

export default class ResourceUtil {


    static getRootFolder(projectNamespace?: string) {
        const newPath = ["/resources"];
        if (projectNamespace) {
            newPath.push(projectNamespace);
        }
        return path.join(...newPath);
    }


    static relativeToRoot(resourcePath: string, projectNamespace?: string) {
        const rootFolder = ResourceUtil.getRootFolder(projectNamespace);
        return path.relative(rootFolder, resourcePath);
    }


    static getResourcePath(projectNamespace?: string, ...paths: string[]) {
        return path.join(this.getRootFolder(projectNamespace), ...paths);
    }


    static write(dir: string, files: Map<string, string>) {
        const fsTarget = resourceFactory.createAdapter({
            fsBasePath: dir,
            virBasePath: "/"
        });
        const promises: Promise<void>[] = [];
        files.forEach((string, filename) => {
            const resource = resourceFactory.createResource({ path: "/" + filename, string });
            promises.push(fsTarget.write(resource));
        });
        return Promise.all(promises);
    }


    private static _read(rootFolder: string, folder: string, files: Map<string, string>, exclude: string[] = []) {
        const entries = fs.readdirSync(folder);
        for (let entry of entries) {
            const entryPath = path.join(folder, entry);
            const stats = fs.lstatSync(entryPath);
            if (stats.isFile() && !exclude.some(filepath => entryPath.endsWith(filepath))) {
                const normalized = entryPath.substring(rootFolder.length + 1);
                files.set(normalized, fs.readFileSync(entryPath, { encoding: "utf-8" }));
            } else if (stats.isDirectory()) {
                this._read(rootFolder, entryPath, files, exclude);
            }
        }
    }


    static read(folder: string): Map<string, string> {
        const files = new Map<string, string>();
        this._read(folder, folder, files);
        return files;
    }


    static getString(resource: any): Promise<string> {
        return resource.getBuffer().then((buffer: Buffer) => buffer.toString(UTF8));
    }


    static getJson(resource: any): Promise<any> {
        return resource.getBuffer().then((buffer: Buffer) => JSON.parse(buffer.toString(UTF8)));
    }


    static setString(resource: any, str: string): void {
        resource.setBuffer(Buffer.from(str, UTF8));
    }


    static createResource(filename: string, projectNamespace: string, content: string) {
        return resourceFactory.createResource({
            path: this.getResourcePath(projectNamespace, filename),
            string: content
        });
    }


    static async toFileMap(resources: ReadonlyArray<Resource>, projectNamespace: string) {
        const files = new Map<string, string>();
        const rootFolderLength = ResourceUtil.getRootFolder(projectNamespace).length;
        for (const resource of resources) {
            files.set(resource.getPath().substring(rootFolderLength + 1), await ResourceUtil.getString(resource));
        }
        return files;
    }

}