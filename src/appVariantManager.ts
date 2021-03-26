import * as path from "path";

import { IAppVariantInfo, IChange } from "./model/types";

import ResourceUtil from "./util/resourceUtil";
import { replaceDots } from "./util/commonUtil";

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
        return appVariantInfo;
    }


    static getAppVariantResources(workspace: any): Promise<any[]> {
        return workspace.byGlob(`/**/*.{${EXTENSIONS}}`);
    }


    static async getAppVariantInfo(appVariantResources: any[]): Promise<IAppVariantInfo> {
        for (const resource of appVariantResources) {
            const basename = path.basename(resource.getPath());
            if (basename === MANIFEST_APP_VARIANT) {
                const manifest = await resource.getBuffer().then((buffer: Buffer) => buffer.toString("utf8")).then(JSON.parse);
                const { id, reference } = manifest;
                return { id, reference, manifest };
            }
        }
        throw new Error("Application variant should contain manifest.appdescr_variant");
    }


    static writeI18nToModule(resource: any, projectNamespace: string, i18nBundleName: string) {
        if (path.extname(resource.getPath()) === ".properties") {
            let rootFolder = ResourceUtil.getRootFolder(projectNamespace);
            if (resource.getPath().startsWith(rootFolder)) {
                resource.setPath(path.join(rootFolder, i18nBundleName, resource.getPath().substring(rootFolder.length)));
            } else {
                resource.setPath(path.join("/", i18nBundleName, resource.getPath()));
            }
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