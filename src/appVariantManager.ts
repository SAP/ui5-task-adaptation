import { IChange } from "./model/types.js";
import ResourceUtil from "./util/resourceUtil.js";
import TaskUtil from "@ui5/project/build/helpers/TaskUtil";
import { posix as path } from "path";
import { rename } from "./util/renamingUtil.js";

const CHANGES_DIR = "changes/";
const CHANGES_EXT = ".change";
const MANIFEST_CHANGE = "appdescr_"

export default class AppVariant {

    readonly files: ReadonlyMap<string, string>;
    readonly resources?: ReadonlyArray<Resource>;
    readonly id: string;
    readonly reference: string;
    readonly layer: any;
    readonly content: any;


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
    }


    getProcessedFiles() {
        const files = new Map<string, string>();
        this.files.forEach((content, filename) => {
            if (filename.startsWith(CHANGES_DIR)) {
                if (!this.isManifestChange(filename, content)) {
                    files.set(filename, rename(content, [this.reference], this.id));
                }
            } else if (filename !== "manifest.appdescr_variant") {
                files.set(filename, content);
            }
        });
        return files;
    }


    getProcessedManifestChanges() {
        // Order is important: apply manifest.json changes first, then *.change
        // files. UI5 does the same.
        const manifestChanges: Array<IChange> = structuredClone(this.content) ?? [];
        this.files.forEach((content, filename) => {
            if (this.isManifestChange(filename, content)) {
                const change = JSON.parse(rename(content, [this.reference], this.id))
                this.updateRelativePaths(change, filename);
                manifestChanges.push(change);
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

    private isManifestChange(filename: string, content: string): boolean {
        if (filename.endsWith(CHANGES_EXT)) {
            const change = JSON.parse(content);
            return change.changeType?.startsWith(MANIFEST_CHANGE);
        }
        return false;
    }

    omitDeletedResources(files: ReadonlyMap<string, string>, projectNamespace: string, taskUtil: TaskUtil) {
        if (!this.resources) {
            return;
        }
        for (const resource of this.resources) {
            const relativePath = ResourceUtil.relativeToRoot(resource.getPath(), projectNamespace);
            if (!files.has(relativePath)) {
                taskUtil.setTag(resource, taskUtil.STANDARD_TAGS.OmitFromBuildResult, true);
            }
        }
    }
}
