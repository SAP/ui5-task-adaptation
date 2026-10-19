import { IChange } from "./model/types.js";
import { bufferToJson, dotToUnderscore, isManifestChange } from "./util/commonUtil.js";
import ResourceUtil, { TEXT_EXTENSIONS } from "./util/resourceUtil.js";
import { posix as path } from "path";
import { moveFile, moveFiles } from "./util/movingHandler/changeFileMoveHandler.js";
import FileRenamer from "./util/renaming/fileRenamer.js";
import { validateAppId } from "./util/validator/validator.js";

const CHANGES_EXT = ".change";

export default class AppVariant {

    readonly files: ReadonlyMap<string, Buffer>;
    readonly resources?: ReadonlyArray<Resource>;
    readonly id: string;
    readonly reference: string;
    readonly layer: any;
    readonly content: any;
    readonly prefix: string;


    static async fromWorkspace(workspace: IWorkspace, projectNamespace: string): Promise<AppVariant> {
        const EXTENSIONS_TO_PROCESS = Array.from(TEXT_EXTENSIONS).join(",");
        const resources = await workspace.byGlob(`/**/*.{${EXTENSIONS_TO_PROCESS}}`);
        const files = await ResourceUtil.toFileMap(resources, projectNamespace);
        return new AppVariant(files, resources);
    }


    static fromFiles(files: ReadonlyMap<string, Buffer>): AppVariant {
        return new AppVariant(files);
    }


    private constructor(files: ReadonlyMap<string, Buffer>, resources?: Resource[]) {
        if (files.size === 0) {
            throw new Error("Application variant sources are empty");
        }
        this.files = files;
        this.resources = resources;

        const manifestBuffer = files.get("manifest.appdescr_variant");
        this.validateManifest(manifestBuffer);
        const { reference, id, layer, content } = bufferToJson(manifestBuffer!);
        this.reference = reference;
        this.id = id;
        validateAppId(id);
        this.layer = layer;
        this.content = content;
        // Prefix is a subfolder for the app variant to store js, fragments,
        // annotations and i18n files. It can be anything, but for convenience
        // it is the app variant id.
        this.prefix = dotToUnderscore(this.id);
    }


    getProcessedFiles(): ReadonlyMap<string, Buffer> {
        const { files, renamingPaths } = moveFiles(this.files, this.prefix, this.id);
        // Directly rename files that with new paths, this ensures no conflict in further renaming
        // In later remaming it's not possible to find correct prefix of moved files
        FileRenamer.rename(files, renamingPaths);
        return files;
    };


    /**
     * The files moved under the prefix folder, as original path -> new path.
     * Computed on demand from the (readonly) sources, so there is no stored
     * cross-phase state to go stale between getProcessedFiles and the post step.
     */
    getMovedFiles(): ReadonlyMap<string, string> {
        return moveFiles(this.files, this.prefix, this.id).movedFiles;
    }


    getProcessedManifestChanges() {
        // Order: manifest changes first, then *.change files sorted by creation ASC
        const manifestChanges: Array<IChange> = structuredClone(this.content) ?? [];
        const changeFileChanges: Array<IChange> = [];

        this.files.forEach((content, filename) => {
            if (filename.endsWith(CHANGES_EXT)) {
                if (isManifestChange(filename, content)) {
                    const { newFilename } = moveFile(filename, content, this.prefix, this.id);
                    const change = bufferToJson(content);
                    this.updateRelativePaths(change, newFilename);
                    changeFileChanges.push(change);
                }
            }
        });
        changeFileChanges.sort(this.sortByTimeStamp);
        manifestChanges.push(...changeFileChanges);
        if (this.layer) {
            manifestChanges.forEach(change => change.layer = this.layer ?? change.layer);
        }
        return manifestChanges;
    }


    private sortByTimeStamp(a: IChange, b: IChange): number {
        if (a.creation < b.creation) return -1;
        if (a.creation > b.creation) return 1;
        return 0;
    }


    private validateManifest(manifest?: Buffer) {
        if (!manifest) {
            throw new Error("Adaptation project should contain manifest.appdescr_variant");
        }
    }


    private updateRelativePaths(change: IChange, filename: string) {
        // TODO In future this should be handled by merger which needs to know change and target location
        if (change.changeType === "appdescr_app_addAnnotationsToOData") {
            for (const dataSource of Object.values(change?.content?.dataSource) as any[]) {
                if (!dataSource.uri.startsWith("/")) {
                    const basepath = path.dirname(filename);
                    dataSource.uri = path.join(basepath.replace(/^\//, ""), dataSource.uri);
                }
            }
        }
    }
}
