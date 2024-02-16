import { IAppVariantInfo } from "./model/types";
import ResourceUtil from "./util/resourceUtil";
import { posix as path } from "path";
import { renameResources } from "./util/commonUtil";

const EXTENSIONS_TO_PROCESS = "js,json,xml,html,properties,change,appdescr_variant,ctrl_variant,ctrl_variant_change,ctrl_variant_management_change,variant,fioriversion,codeChange,xmlViewChange,context";

export default class AppVariantManager {

    static async process(appVariantResources: any[], projectNamespace: string, taskUtil: any): Promise<IAppVariantInfo> {
        for (const resource of appVariantResources) {
            this.omitFiles(resource, taskUtil);
        }
        await this.updateChanges(appVariantResources, projectNamespace);
        return this.getAppVariantInfo(appVariantResources);
    }


    static getAppVariantResourcesToProcess(workspace: any): Promise<any[]> {
        return workspace.byGlob(`/**/*.{${EXTENSIONS_TO_PROCESS}}`);
    }


    static async updateChanges(appVariantResources: any[], projectNamespace: string): Promise<void> {
        const changesFolder = ResourceUtil.getResourcePath(projectNamespace, "changes");
        const changes = new Map<string, string>();
        const resourcesByPath = new Map<string, any>();
        let manifest;
        for (const resource of appVariantResources) {
            if (this.isManifestAppVariant(resource)) {
                manifest = await ResourceUtil.getJson(resource);
            }
            const resourcePath = resource.getPath();
            const basename = path.dirname(resourcePath);
            if (basename.startsWith(changesFolder)) {
                changes.set(resourcePath, await ResourceUtil.getString(resource));
                resourcesByPath.set(resourcePath, resource);
            }
        }
        this.updateRelativePaths(changes, projectNamespace);
        this.validateManifest(manifest);
        const renamedChanges = renameResources(changes, manifest.reference, manifest.id);
        renamedChanges.forEach((renamedContent, resourcePath) => {
            const resource = resourcesByPath.get(resourcePath);
            ResourceUtil.setString(resource, renamedContent);
        });
    }


    private static isManifestChange(resource: any) {
        const changesManifestFolder = path.join("changes", "manifest");
        const resourcePath = typeof resource === "string" ? resource : resource.getPath();
        const dirname = path.dirname(resourcePath);
        return dirname.endsWith(changesManifestFolder);
    }


    private static isManifestAppVariant(resource: any) {
        const MANIFEST_APP_VARIANT = "manifest.appdescr_variant";
        const basename = path.basename(resource.getPath());
        return basename === MANIFEST_APP_VARIANT;
    }


    static async getAppVariantInfo(appVariantResources: any[]): Promise<IAppVariantInfo> {
        let manifest;
        const manifestChanges = [];
        for (const resource of appVariantResources) {
            if (this.isManifestAppVariant(resource)) {
                manifest = await ResourceUtil.getJson(resource);
            } else if (this.isManifestChange(resource)) {
                const content = await ResourceUtil.getString(resource);
                manifestChanges.push(JSON.parse(content));
            }
        }
        this.validateManifest(manifest);
        return {
            id: manifest.id,
            reference: manifest.reference,
            layer: manifest.layer,
            changes: manifestChanges.concat(manifest.content)
        };
    }


    private static validateManifest(manifest: any) {
        if (!manifest) {
            throw new Error("Adaptation project should contain manifest.appdescr_variant");
        }
    }


    // TODO In future this should be handled by merger which needs to know change and target location
    private static updateRelativePaths(changes: Map<string, string>, projectNamespace: string) {
        changes.forEach((jsonString, resourcePath) => {
            if (this.isManifestChange(resourcePath)) {
                const change = JSON.parse(jsonString);
                if (change.changeType === "appdescr_app_addAnnotationsToOData") {
                    for (const dataSource of Object.values(change.content.dataSource) as any[]) {
                        if (!dataSource.uri.startsWith("/")) {
                            const basepath = path.dirname(ResourceUtil.relativeToRoot(resourcePath, projectNamespace));
                            dataSource.uri = path.join(basepath.replace(/^\//, ""), dataSource.uri);
                        }
                    }
                    changes.set(resourcePath, JSON.stringify(change));
                }
            }
        });
    }


    private static omitFiles(resource: any, taskUtil: any) {
        if (this.isManifestAppVariant(resource) || this.isManifestChange(resource)) {
            taskUtil.setTag(resource, taskUtil.STANDARD_TAGS.OmitFromBuildResult, true);
        }
    }
}
