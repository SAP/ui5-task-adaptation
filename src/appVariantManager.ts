/// <reference path="../types/index.d.ts"/>
import * as path from "path";
import { DuplexCollection, Resource } from "@ui5/fs/lib";
import TaskUtil from "@ui5/builder/lib/tasks/TaskUtil";
import { IAppVariantInfo, IChange } from "./model/types";
import ResourceUtil from "./util/resourceUtil";
import Logger from "@ui5/logger";
const log: Logger = require("@ui5/logger").getLogger("@ui5/task-adaptation::AppVariantManager");

const OMIT_FILES: string[] = ["manifest.appdescr_variant"];
const OMIT_FOLDERS: string[] = [];
const EXTENSIONS = "js,json,xml,html,properties,change,appdescr_variant";
const MANIFEST_APP_VARIANT = "manifest.appdescr_variant";

export default class AppVariantManager {

    static async process(appVariantResources: Resource[], projectNamespace: string, taskUtil: TaskUtil): Promise<IAppVariantInfo> {
        const appVariantInfo = await this.getAppVariantInfo(appVariantResources);
        const i18nBundleName = this.getI18nBundleName(appVariantInfo.id);
        for (const resource of appVariantResources) {
            this.writeI18nToModule(resource, projectNamespace, i18nBundleName);
            this.omitFiles(resource, taskUtil);
        }
        this.adjustAddNewModelEnhanceWith(appVariantInfo?.manifest?.content ?? [], i18nBundleName);
        return appVariantInfo;
    }

    static getAppVariantResources(workspace: DuplexCollection): Promise<Resource[]> {
        return workspace.byGlob(`/**/*.{${EXTENSIONS}}`);
    }

    static async getAppVariantInfo(appVariantResources: Resource[]): Promise<IAppVariantInfo> {
        for (const resource of appVariantResources) {
            const basename = path.basename(resource.getPath());
            if (basename === MANIFEST_APP_VARIANT) {
                const manifest = await resource.getBuffer().then(buffer => buffer.toString("utf8")).then(JSON.parse);
                const { id, reference } = manifest;
                return { id, reference, manifest };
            }
        }
        throw new Error("Application variant should contain manifest.appdescr_variant");
    }

    static writeI18nToModule(resource: Resource, projectNamespace: string, i18nBundleName: string) {
        if (path.extname(resource.getPath()) === ".properties") {
            const paths = ResourceUtil.filepathToResources(projectNamespace);
            const rootFolder = path.join(...paths);
            paths.push(i18nBundleName);
            paths.push(resource.getPath().substring(rootFolder.length));
            resource.setPath(path.join(...paths));
        }
    }

    private static omitFiles(resource: Resource, taskUtil: TaskUtil) {
        const dirname = path.dirname(resource.getPath());
        const filename = path.basename(resource.getPath());
        if (OMIT_FILES.includes(filename) ||
            OMIT_FOLDERS.some(folder => dirname.endsWith(folder))) {
            taskUtil.setTag(resource, taskUtil.STANDARD_TAGS.OmitFromBuildResult, true);
        }
    }

    static getI18nBundleName(appVariantId: string) {
        return appVariantId.replace(/\./g, "_");
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