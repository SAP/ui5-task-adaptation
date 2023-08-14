import * as fs from "fs";
import * as path from "path";

const resourceFactory = require("@ui5/fs/lib/resourceFactory");

export default class ResourceUtil {


    static getRootFolder(projectNamespace?: string) {
        const newPath = ["/resources"];
        if (projectNamespace) {
            newPath.push(projectNamespace);
        }
        return path.join(...newPath);
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


    static read(rootFolder: string, folder: string, files: Map<string, string>, exclude: string[] = []) {
        const entries = fs.readdirSync(folder);
        for (let entry of entries) {
            const entryPath = path.join(folder, entry);
            const stats = fs.lstatSync(entryPath);
            if (stats.isFile() && !exclude.some(filepath => entryPath.endsWith(filepath))) {
                const normalized = entryPath.substring(rootFolder.length);
                files.set(normalized, fs.readFileSync(entryPath, { encoding: "utf-8" }));
            } else if (stats.isDirectory()) {
                this.read(rootFolder, entryPath, files, exclude);
            }
        }
    }


}