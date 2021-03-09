/// <reference path="../types/index.d.ts"/>
import { IAppVariantInfo, IBaseAppInfo, IBaseAppManifest, IChange, IConfiguration, IProjectOptions } from "./model/types";
import BuildStrategy from "./buildStrategy";
import { RegistrationBuild, Change, Applier, ApplyUtil } from "../dist/bundle";
import AppVariantManager from "./appVariantManager";
import * as path from "path";
import ResourceUtil from "./util/resourceUtil";
import { Resource } from "@ui5/fs/lib";
import * as resourceFactory from "@ui5/fs/lib/resourceFactory";
import Logger from "@ui5/logger";
const log: Logger = require("@ui5/logger").getLogger("@ui5/task-adaptation::BaseAppManager");

export class BaseAppManager {

    static async process(baseAppFiles: Map<string, string>, appVariantInfo: IAppVariantInfo, options: IProjectOptions): Promise<Resource[]> {
        this.renameBaseApp(baseAppFiles, appVariantInfo.reference, appVariantInfo.id);
        const baseAppInfo = this.getBaseAppManifest(baseAppFiles);
        this.updateCloudPlatform(baseAppInfo.content, options.configuration);
        const i18nBundleName = AppVariantManager.getI18nBundleName(appVariantInfo.id);
        await this.applyDescriptorChanges(baseAppInfo.content, appVariantInfo.manifest.content, i18nBundleName);
        baseAppFiles.set(baseAppInfo.filepath, JSON.stringify(baseAppInfo.content));
        return this.writeToWorkspace(baseAppFiles, options.projectNamespace);
    }

    static renameBaseApp(baseAppFiles: Map<string, string>, search: string, replacement: string) {
        log.verbose("Renaming base app resources to appVariant id");
        const dotToSlash = (update: string) => update.split(".").join("\/");
        const dotsEscape = (update: string) => update.split(".").join("\\.");
        const replaces = [
            {
                regexp: new RegExp(dotsEscape(search), "g"),
                replacement
            },
            {
                regexp: new RegExp(dotToSlash(search), "g"),
                replacement: dotToSlash(replacement)
            }
        ];
        baseAppFiles.forEach((content: string, filepath: string, map: Map<string, string>) => {
            map.set(filepath, replaces.reduce((p, c) => p.replace(c.regexp, c.replacement), content));
        });
    }

    private static getBaseAppManifest(baseAppFiles: Map<string, string>): IBaseAppInfo {
        let filepath = [...baseAppFiles.keys()].find(filepath => filepath.endsWith("manifest.json"));
        if (filepath) {
            return {
                content: JSON.parse(baseAppFiles.get(filepath)!), // "!" means that I'm sure that baseAppFiles.get(manifestPath) won't return undefined
                filepath
            }
        }
        throw new Error("Original application should have manifest.json in root folder");
    }

    static updateCloudPlatform(baseAppManifest: IBaseAppManifest, configuration: IConfiguration) {
        let sapCloudService = baseAppManifest["sap.cloud"]?.service;
        let sapPlatformCf = baseAppManifest["sap.platform.cf"];
        if (sapPlatformCf && sapCloudService) {
            sapPlatformCf.oAuthScopes = sapPlatformCf.oAuthScopes.map(scope =>
                scope.replace(`$XSAPPNAME.`, `$XSAPPNAME('${sapCloudService}').`));
        }
        if (configuration.sapCloudService) {
            if (baseAppManifest["sap.cloud"] == null) {
                baseAppManifest["sap.cloud"] = {};
            }
            baseAppManifest["sap.cloud"].service = configuration.sapCloudService;
        } else {
            delete baseAppManifest["sap.cloud"];
        }
    }

    static fillAppVariantIdHierarchy(baseAppManifest: IBaseAppManifest) {
        log.info("Filling up app variant hierarchy in manifest.json");
        const id = baseAppManifest["sap.app"]?.id;
        const version = baseAppManifest["sap.app"]?.applicationVersion?.version;
        this.validateProperty(id, "sap.app/id");
        this.validateProperty(version, "sap.app/applicationVersion/version");
        baseAppManifest["sap.ui5"].appVariantIdHierarchy = [{
            appVariantId: id,
            version
        }];
    }

    private static validateProperty(value: string, property: string) {
        if (!value) {
            throw new Error(`Original application manifest should have ${property}`);
        }
    }

    static async applyDescriptorChanges(baseAppManifest: IBaseAppManifest, changes: IChange[], i18nBundleName: string) {
        log.verbose("Applying appVariant changes");
        const strategy = new BuildStrategy(RegistrationBuild, ApplyUtil, i18nBundleName);
        const changesContent = changes?.map((change: IChange) => new Change(change));
        if (changesContent) {
            await Applier.applyChanges(baseAppManifest, changesContent, strategy);
        }
    }

    static writeToWorkspace(baseAppFiles: Map<string, string>, projectNamespace: string) {
        const IGNORE_FILES = [
            "/manifest-bundle.zip",
            "/Component-preload.js",
            "/sap-ui-cachebuster-info.json"
        ];
        const resources = [];
        for (let filename of baseAppFiles.keys()) {
            const filepath = getPath(filename, projectNamespace);
            if (!IGNORE_FILES.includes(filepath) && path.extname(filepath) !== "") {
                const resource = resourceFactory.createResource({
                    path: filepath,
                    string: baseAppFiles.get(filename)!
                });
                resources.push(resource);
            }
        }
        return resources;
    }

}

const getPath = (filename: string, projectNamespace: string) => {
    const paths = ResourceUtil.filepathToResources(projectNamespace);
    paths.push(filename);
    return path.resolve("/" + path.join(...paths));
};