import { IAppVariantInfo, IChange } from "./model/types";
import { renameResources, replaceDots } from "./util/commonUtil";

import ResourceUtil from "./util/resourceUtil";
import { posix as path } from "path";

const log = require("@ui5/logger").getLogger("@ui5/task-adaptation::AppVariantManager");

const OMIT_FILES: string[] = ["manifest.appdescr_variant"];
const OMIT_FOLDERS: string[] = [];
const EXTENSIONS = "js,json,xml,html,properties,change,appdescr_variant";
const MANIFEST_APP_VARIANT = "manifest.appdescr_variant";

export default class AppVariantManager {

    static async process(appVariantResources: any[], projectNamespace: string, taskUtil: any): Promise<IAppVariantInfo> {
        const appVariantInfo = await this.getAppVariantInfo(appVariantResources);
        const i18nBundleName = replaceDots(appVariantInfo.id);
        for (const resource of appVariantResources) {
            this.writeI18nToModule(resource, projectNamespace, i18nBundleName);
            this.omitFiles(resource, taskUtil);
        }
        this.adjustAddNewModelEnhanceWith(appVariantInfo?.manifest?.content ?? [], i18nBundleName);
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
            if (changesFolder === basename) {
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


    static async getAppVariantInfo(appVariantResources: any[]): Promise<IAppVariantInfo> {
        const changesManifestFolder = path.join("changes", "manifest");
        let manifest;
        const manifestChanges = [];
        for (const resource of appVariantResources) {
            const resourcePath = resource.getPath();
            const dirname = path.dirname(resource.getPath());
            const basename = path.basename(resourcePath);
            if (basename === MANIFEST_APP_VARIANT) {
                manifest = await ResourceUtil.getString(resource).then(JSON.parse);
            } else if (dirname.endsWith(changesManifestFolder)) {
                const str = await ResourceUtil.getString(resource);
                manifestChanges.push(JSON.parse(str));
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


    static writeI18nToModule(resource: any, projectNamespace: string, i18nBundleName: string) {
        if (path.extname(resource.getPath()) === ".properties") {
            let rootFolder = ResourceUtil.getRootFolder(projectNamespace);
            resource.setPath(path.join(rootFolder, i18nBundleName, resource.getPath().substring(rootFolder.length)));
        }
    }


    private static omitFiles(resource: any, taskUtil: any) {
        const dirname = path.dirname(resource.getPath());
        const filename = path.basename(resource.getPath());
        if (OMIT_FILES.includes(filename) ||
            OMIT_FOLDERS.some(folder => dirname.endsWith(folder))) {
            taskUtil.setTag(resource, taskUtil.STANDARD_TAGS.OmitFromBuildResult, true);
        }
    }


    private static adjustAddNewModelEnhanceWith(changes: IChange[], i18nBundleName: string) {
        log.verbose("Adjusting appdescr_ui5_addNewModelEnhanceWith with module");
        for (const change of changes) {
            if (change.changeType === "appdescr_ui5_addNewModelEnhanceWith") {
                if (!change.texts) {
                    change.texts = { i18n: "i18n/i18n.properties" };
                }
                change.texts.i18n = i18nBundleName + "/" + change.texts.i18n;
            }
        }
    }

}