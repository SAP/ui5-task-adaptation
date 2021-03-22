import * as path from "path";

import { IAppVariantInfo, IBaseAppInfo, IChange, IConfiguration, IProjectOptions } from "./model/types";

import BuildStrategy from "./buildStrategy";
import ResourceUtil from "./util/resourceUtil";
import { replaceDots } from "./util/commonUtil";

const { RegistrationBuild, ApplyUtil, Applier, Change } = require("../dist/bundle");
const resourceFactory = require("@ui5/fs/lib/resourceFactory");
const log = require("@ui5/logger").getLogger("@ui5/task-adaptation::BaseAppManager");

export default class BaseAppManager {

    static async process(baseAppFiles: Map<string, string>, appVariantInfo: IAppVariantInfo, options: IProjectOptions): Promise<any[]> {
        const { filepath, content } = this.getBaseAppManifest(baseAppFiles);
        this.renameBaseApp(baseAppFiles, appVariantInfo.reference, appVariantInfo.id);
        this.updateCloudPlatform(content, options.configuration);
        this.fillAppVariantIdHierarchy(content);
        const i18nBundleName = replaceDots(appVariantInfo.id);
        await this.applyDescriptorChanges(content, appVariantInfo.manifest.content, i18nBundleName);
        baseAppFiles.set(filepath, JSON.stringify(content));
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
                content: JSON.parse(baseAppFiles.get(filepath)!),
                filepath
            }
        }
        throw new Error("Original application should have manifest.json in root folder");
    }


    private static updateCloudPlatform(baseAppManifest: any, configuration: IConfiguration) {
        const sapCloudService = baseAppManifest["sap.cloud"]?.service;
        const sapPlatformCf = baseAppManifest["sap.platform.cf"];
        if (sapPlatformCf && sapCloudService) {
            sapPlatformCf.oAuthScopes = sapPlatformCf.oAuthScopes.map((scope: string) =>
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


    private static fillAppVariantIdHierarchy(baseAppManifest: any) {
        log.info("Filling up app variant hierarchy in manifest.json");
        const id = baseAppManifest["sap.app"]?.id;
        const version = baseAppManifest["sap.app"]?.applicationVersion?.version;
        this.validateProperty(id, "sap.app/id");
        this.validateProperty(version, "sap.app/applicationVersion/version");
        if (baseAppManifest["sap.ui5"] == null) {
            baseAppManifest["sap.ui5"] = {};
        }
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


    static async applyDescriptorChanges(baseAppManifest: any, changes: IChange[], i18nBundleName: string) {
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
    const rootFolder = ResourceUtil.getRootFolder(projectNamespace);
    return path.resolve(path.join(rootFolder, filename));
};