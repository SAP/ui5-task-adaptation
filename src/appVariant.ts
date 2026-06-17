import { IChange } from "./model/types.js";
import { dotToUnderscore, isManifestChange } from "./util/commonUtil.js";
import ResourceUtil, { TEXT_EXTENSIONS } from "./util/resourceUtil.js";
import { posix as path } from "path";
import { moveFile, moveFiles } from "./util/movingHandler/changeFileMoveHandler.js";
import RenameFilesCommand from "./adapters/commands/renameFilesCommand.js";
import { validateAppId } from "./util/validator/validator.js";

const CHANGES_EXT = ".change";

export default class AppVariant {

    readonly files: ReadonlyMap<string, string>;
    readonly resources?: ReadonlyArray<Resource>;
    readonly id: string;
    readonly reference: string;
    readonly layer: any;
    readonly content: any;
    prefix: string = "";
    movedFiles = new Map<string, string>();
    private renaming = new Map<string, string>();


    static async fromWorkspace(workspace: IWorkspace, projectNamespace: string): Promise<AppVariant> {
        const EXTENSIONS_TO_PROCESS = Array.from(TEXT_EXTENSIONS).join(",");
        const resources = await workspace.byGlob(`/**/*.{${EXTENSIONS_TO_PROCESS}}`);
        const files = await ResourceUtil.toFileMap(resources, projectNamespace);
        return new AppVariant(files, resources);
    }


    static fromFiles(files: ReadonlyMap<string, string>): AppVariant {
        return new AppVariant(files);
    }


    private constructor(files: ReadonlyMap<string, string>, resources?: Resource[]) {
        if (files.size === 0) {
            throw new Error("Application variant sources are empty");
        }
        this.files = files;
        this.resources = resources;

        const manifestString = files.get("manifest.appdescr_variant");
        this.validateManifest(manifestString);
        const { reference, id, layer, content } = JSON.parse(manifestString!);
        this.reference = reference;
        this.id = id;
        validateAppId(id);
        this.layer = layer;
        this.content = content;
        // Prefix is a subfolder for the app variant to store js, fragments,
        // annotations and i18n files. It can be anything, but for convenience
        // it is an app variant id.
        this.prefix = dotToUnderscore(this.id);
    }


    getProcessedFiles(): ReadonlyMap<string, string> {
        const { files, renamingPaths } = moveFiles(this.files, this.prefix, this.id);
        // Directly rename files that with new paths, this ensures no conflict in further renaming
        // In later remaming it's not possible to find correct prefix of moved files
        new RenameFilesCommand(renamingPaths).execute(files);
        return files;
    };

    /** 
     * Since we moved files, we need to update paths where they were referenced.
     * To do this we use renameMap function along with renaming ids.
     */
    getRenamingForMovedFiles(): Map<string, string> {
        const renaming = new Map<string, string>();
        const slashToDot = (str: string) => str.replaceAll("\/", ".");
        this.renaming.forEach((newPath, oldPath) => {
            renaming.set(slashToDot(oldPath), slashToDot(newPath));
        });
        return renaming;
    };


    getProcessedManifestChanges() {
        // Order: manifest changes first, then *.change files sorted by creation ASC
        const manifestChanges: Array<IChange> = structuredClone(this.content) ?? [];
        const changeFileChanges: Array<IChange> = [];

        this.files.forEach((content, filename) => {
            if (filename.endsWith(CHANGES_EXT)) {
                const change = JSON.parse(content);
                if (isManifestChange(filename, content)) {
                    const { newFilename } = moveFile(filename, content, this.prefix, this.id);
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


    private validateManifest(manifest?: string) {
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
