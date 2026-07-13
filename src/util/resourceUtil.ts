import * as resourceFactory from "@ui5/fs/resourceFactory";
import { posix as path } from "path";

const UTF8 = "utf8";

/**
 * Extensions of files whose contents are processed by the adaptation
 * pipeline as text. Anything outside this whitelist is treated as binary
 * (e.g. images, fonts) and is saved to the workspace verbatim by WorkspaceManager.
 *
 * Kept in sync with EXTENSIONS_TO_PROCESS in appVariant.ts.
 */
export const TEXT_EXTENSIONS: ReadonlySet<string> = new Set([
    "js",
    "json",
    "xml",
    "html",
    "properties",
    "change",
    "appdescr_variant",
    "ctrl_variant",
    "ctrl_variant_change",
    "ctrl_variant_management_change",
    "annotation_change",
    "variant",
    "fioriversion",
    "codeChange",
    "xmlViewChange",
    "context",
]);

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
     * @param files A Map of file paths and their contents as Buffer.
     * @returns A promise that resolves when all files have been written.
     */
    static write(dir: string, files: Map<string, Buffer>) {
        const fsTarget = resourceFactory.createAdapter({
            fsBasePath: dir,
            virBasePath: "/"
        });
        const promises: Promise<void>[] = [];
        files.forEach((content, filename) => {
            const resource = ResourceUtil.createResourceFromContent("/" + filename, content);
            promises.push(fsTarget.write(resource));
        });
        return Promise.all(promises);
    }


    /*
     * Write files to the project folder (folder where 'webapp',
     * 'package.json', 'ui5.yaml' located), use writeInProject method.
     * @param dir The directory to write files to.
     * @param files A Map of file paths and their contents as Buffer.
     * @returns A promise that resolves when all files have been written.
     */
    static writeInProject(dir: string, files: Map<string, Buffer>) {
        return ResourceUtil.write(path.join("./", dir), files);
    }


    /*
     * Search files in the given folder, excluding specified glob patterns.
     * NOTE: to search in project folder (folder where 'webapp',
     * 'package.json', 'ui5.yaml' located), use byGlobInProject method.
     * @param dir The directory to search in.
     * @param pattern The glob pattern to match files, e.g., "/ui5AppInfo.json".
     * @param excludes An array of glob patterns to exclude from the search.
     * @returns A promise that resolves to a Map of file paths and their contents as Buffer.
     */
    static async byGlob(dir: string, pattern: string, excludes: string[] = []): Promise<Map<string, Buffer>> {
        const adapter = resourceFactory.createAdapter({
            fsBasePath: dir,
            virBasePath: "/",
            excludes
        });
        const resources = await adapter.byGlob(pattern) as ReadonlyArray<Resource>;
        const files = new Map<string, Buffer>();
        for (const resource of resources) {
            files.set(resource.getPath().substring(1), await resource.getBuffer());
        }
        return files;
    }


    /*
     * Search files in the adaptation project (folder where 'webapp',
     * 'package.json', 'ui5.yaml' located), excluding specified glob patterns.
     * @param pattern The glob pattern to match files, e.g., "/ui5AppInfo.json".
     * @param excludes An array of glob patterns to exclude from the search.
     * @returns A promise that resolves to a Map of file paths and their contents as Buffer.
     */
    static byGlobInProject(pattern: string, excludes: string[] = []): Promise<Map<string, Buffer>> {
        return ResourceUtil.byGlob("./", pattern, [
            "/node_modules",
            "/dist",
            "/.adp/reuse"
        ].concat(excludes));
    }


    static getString(resource: any): Promise<string> {
        return resource.getBuffer().then((buffer: Buffer) => buffer.toString(UTF8).replaceAll("\r\n", "\n"));
    }


    static getJson(resource: any): Promise<any> {
        return resource.getBuffer().then((buffer: Buffer) => JSON.parse(buffer.toString(UTF8)));
    }


    static setString(resource: any, str: string): void {
        resource.setBuffer(Buffer.from(str, UTF8));
    }


    static createResource(filename: string, projectNamespace: string, content: string | Buffer) {
        return ResourceUtil.createResourceFromContent(
            this.getResourcePath(projectNamespace, filename),
            content
        );
    }


    private static createResourceFromContent(resourcePath: string, content: string | Buffer) {
        return resourceFactory.createResource(
            Buffer.isBuffer(content)
                ? { path: resourcePath, buffer: content }
                : { path: resourcePath, string: content }
        );
    }


    static async toFileMap(resources: ReadonlyArray<Resource>, projectNamespace?: string): Promise<Map<string, Buffer>> {
        const files = new Map<string, Buffer>();
        const rootFolderLength = projectNamespace ? ResourceUtil.getRootFolder(projectNamespace).length : 0;
        for (const resource of resources) {
            files.set(resource.getPath().substring(rootFolderLength + 1), await resource.getBuffer());
        }
        return files;
    }
}
