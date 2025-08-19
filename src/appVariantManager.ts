import { IChange } from "./model/types.js";
import { dotToUnderscore, isManifestChange } from "./util/commonUtil.js";
import FilesUtil from "./util/filesUtil.js";
import ResourceUtil from "./util/resourceUtil.js";
import TaskUtil from "@ui5/project/build/helpers/TaskUtil";
import { posix as path } from "path";
import { moveFile, moveFiles } from "./util/movingHandler/fileMoveHandler.js";

const CHANGES_EXT = ".change";

export default class AppVariant {

    readonly files: ReadonlyMap<string, string>;
    readonly resources?: ReadonlyArray<Resource>;
    readonly id: string;
    readonly reference: string;
    readonly layer: any;
    readonly content: any;
    prefix: string = "";
    private movedFiles = new Map<string, string>();
    private renaming = new Map<string, string>();


    static async fromWorkspace(workspace: IWorkspace, projectNamespace: string): Promise<AppVariant> {
        const EXTENSIONS_TO_PROCESS = "js,json,xml,html,properties,change,appdescr_variant,ctrl_variant,ctrl_variant_change,ctrl_variant_management_change,variant,fioriversion,codeChange,xmlViewChange,context";
        const resources = await workspace.byGlob(`/**/*.{${EXTENSIONS_TO_PROCESS}}`);
        const files = await ResourceUtil.toFileMap(resources, projectNamespace);
        return new AppVariant(files, resources);
    }


    static fromFiles(files: ReadonlyMap<string, string>): AppVariant {
        return new AppVariant(files);
    }


    private constructor(files: ReadonlyMap<string, string>, resources?: Resource[]) {
        this.files = files;
        this.resources = resources;

        const manifestString = files.get("manifest.appdescr_variant");
        this.validateManifest(manifestString);
        const { reference, id, layer, content } = JSON.parse(manifestString!);
        this.reference = reference;
        this.id = id;
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
        return FilesUtil.rename(files, renamingPaths);
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
        // Order: manifest changes first, then *.change files
        const manifestChanges: Array<IChange> = structuredClone(this.content) ?? [];

        this.files.forEach((content, filename) => {
            if (filename.endsWith(CHANGES_EXT)) {
                const change = JSON.parse(content);
                if (isManifestChange(filename, content)) {
                    const { newFilename } = moveFile(filename, content, this.prefix, this.id);
                    this.updateRelativePaths(change, newFilename);
                    manifestChanges.push(change);
                }
            }
        });
        if (this.layer) {
            manifestChanges.forEach(change => change.layer = this.layer ?? change.layer);
        }
        return manifestChanges;
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

    /**
     * 3p. We not only omit files, which were moved or deleted from the resulted
     * file set, but also update existing adaptation project resources with
     * renamed content, otherwise flexibility-bundle will contain not renamed
     * content of files.
     */
    omitDeletedResources(files: ReadonlyMap<string, string>, projectNamespace: string, taskUtil: TaskUtil) {
        if (!this.resources) {
            return;
        }
        for (const resource of this.resources) {
            const relativePath = ResourceUtil.relativeToRoot(resource.getPath(), projectNamespace);
            if (!files.has(relativePath)) {
                taskUtil.setTag(resource, taskUtil.STANDARD_TAGS.OmitFromBuildResult, true);
                if (this.movedFiles.has(relativePath)) {
                    const newPath = this.movedFiles.get(relativePath)!;
                    const renamedContent = files.get(newPath)!;
                    resource.setString(renamedContent);
                }
            }
        }
    }
}
