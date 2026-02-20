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


    /*
     * Write files to the specified folder.
     * NOTE: to write in project folder (folder where 'webapp',
     * 'package.json', 'ui5.yaml' located), use writeInProject method.
     * @param dir The directory to write files to.
     * @param files A Map of file paths and their contents.
     * @returns A promise that resolves when all files have been written.
     */
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


    /*
     * Write files to the project folder (folder where 'webapp',
     * 'package.json', 'ui5.yaml' located), use writeInProject method.
     * @param dir The directory to write files to.
     * @param files A Map of file paths and their contents.
     * @returns A promise that resolves when all files have been written.
     */
    static writeInProject(dir: string, files: Map<string, string>) {
        return ResourceUtil.write(path.join("./", dir), files);
    }


    /*
     * Search files in the given folder, excluding specified glob patterns. 
     * NOTE: to search in project folder (folder where 'webapp',
     * 'package.json', 'ui5.yaml' located), use byGlobInProject method.
     * @param dir The directory to search in.
     * @param pattern The glob pattern to match files, e.g., "/ui5AppInfo.json". 
     * @param excludes An array of glob patterns to exclude from the search. 
     * @returns A promise that resolves to a Map of file paths and their contents.
     */
    static byGlob(dir: string, pattern: string, excludes: string[] = []): Promise<Map<string, string>> {
        const adapter = resourceFactory.createAdapter({
            fsBasePath: dir,
            virBasePath: "/",
            excludes
        });
        return adapter.byGlob(pattern).then((resources: ReadonlyArray<Resource>) => this.toFileMap(resources));
    }


    /*
     * Search files in the adaptation project (folder where 'webapp',
     * 'package.json', 'ui5.yaml' located), excluding specified glob patterns. 
     * @param pattern The glob pattern to match files, e.g., "/ui5AppInfo.json". 
     * @param excludes An array of glob patterns to exclude from the search. 
     * @returns A promise that resolves to a Map of file paths and their contents.
     */
    static byGlobInProject(pattern: string, excludes: string[] = []): Promise<Map<string, string>> {
        return ResourceUtil.byGlob("./", pattern, [
            "/node_modules",
            "/dist",
            "/.adp/reuse"
        ].concat(excludes));
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


    static async toFileMap(resources: ReadonlyArray<Resource>, projectNamespace?: string) {
        const files = new Map<string, string>();
        const rootFolderLength = projectNamespace ? ResourceUtil.getRootFolder(projectNamespace).length : 0;
        for (const resource of resources) {
            files.set(resource.getPath().substring(rootFolderLength + 1), await ResourceUtil.getString(resource));
        }
        return files;
    }
}
