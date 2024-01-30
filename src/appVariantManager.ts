import { IAppVariantInfo } from "./model/types";
import ResourceUtil from "./util/resourceUtil";
import { posix as path } from "path";
import { renameResources } from "./util/commonUtil";

const EXTENSIONS = "js,json,xml,html,properties,change,appdescr_variant";

export default class AppVariantManager {

    static async process(appVariantResources: any[], projectNamespace: string, taskUtil: any): Promise<IAppVariantInfo> {
        const appVariantInfo = await this.getAppVariantInfo(appVariantResources);
        for (const resource of appVariantResources) {
            this.omitFiles(resource, taskUtil);
        }
        await this.renameChanges(appVariantResources, projectNamespace, appVariantInfo);
        return appVariantInfo;
    }


    static getAppVariantResources(workspace: any): Promise<any[]> {
        return workspace.byGlob(`/**/*.{${EXTENSIONS}}`);
    }


    static async renameChanges(appVariantResources: any[], projectNamespace: string, appVariantInfo: IAppVariantInfo): Promise<void> {
        const changesFolder = ResourceUtil.getResourcePath(projectNamespace, "changes");
        const changes = new Map<string, string>();
        const resourcesByPath = new Map<string, any>();
        for (const resource of appVariantResources) {
            const resourcePath = resource.getPath();
            const basename = path.dirname(resourcePath);
            if (basename.startsWith(changesFolder)) {
                changes.set(resourcePath, await ResourceUtil.getString(resource));
                resourcesByPath.set(resourcePath, resource);
            }
        }
        const renamedChanges = renameResources(changes, appVariantInfo.reference, appVariantInfo.id);
        renamedChanges.forEach((renamedContent, resourcePath) => {
            const resource = resourcesByPath.get(resourcePath);
            ResourceUtil.setString(resource, renamedContent);
        });
    }


    private static isManifestChange(resource: any) {
        const changesManifestFolder = path.join("changes", "manifest");
        const dirname = path.dirname(resource.getPath());
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
                manifest = await ResourceUtil.getString(resource).then(JSON.parse);
            } else if (this.isManifestChange(resource)) {
                const content = await ResourceUtil.getString(resource);
                manifestChanges.push(JSON.parse(content));
            }
        }
        if (manifest) {
            return {
                id: manifest.id,
                reference: manifest.reference,
                manifest,
                manifestChanges
            };
        }
        throw new Error("Adaptation project should contain manifest.appdescr_variant");
    }


    private static omitFiles(resource: any, taskUtil: any) {
        if (this.isManifestAppVariant(resource) || this.isManifestChange(resource)) {
            taskUtil.setTag(resource, taskUtil.STANDARD_TAGS.OmitFromBuildResult, true);
        }
    }

}