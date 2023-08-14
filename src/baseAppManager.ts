import * as path from "path";

import { IAppVariantInfo, IAppVariantManifest, IBaseAppInfo, IChange, IProjectOptions } from "./model/types";

import BuildStrategy from "./buildStrategy";
import IProcessor from "./processors/processor";
import ResourceUtil from "./util/resourceUtil";
import { replaceDots } from "./util/commonUtil";

const { RegistrationBuild, ApplyUtil, Applier, Change } = require("../dist/bundle");
const resourceFactory = require("@ui5/fs/lib/resourceFactory");
const log = require("@ui5/logger").getLogger("@ui5/task-adaptation::BaseAppManager");

export default class BaseAppManager {

    static async process(baseAppFiles: Map<string, string>, appVariantInfo: IAppVariantInfo, options: IProjectOptions, processor: IProcessor): Promise<any[]> {
        const baseAppManifest = this.getBaseAppManifest(baseAppFiles);
        const { id, version } = this.getManifestInfo(baseAppManifest.content);

        const renamedBaseAppFiles = this.renameBaseApp(baseAppFiles, appVariantInfo.reference, appVariantInfo.id);
        const { filepath, content } = this.getBaseAppManifest(renamedBaseAppFiles);
        await processor.updateLandscapeSpecificContent(content, renamedBaseAppFiles);
        this.fillAppVariantIdHierarchy(processor, id, version, content);
        this.updateAdaptationProperties(content);
        const i18nBundleName = replaceDots(appVariantInfo.id);
        await this.applyDescriptorChanges(content, appVariantInfo.manifest, i18nBundleName);
        renamedBaseAppFiles.set(filepath, JSON.stringify(content));

        return this.writeToWorkspace(renamedBaseAppFiles, options.projectNamespace);
    }


    private static updateAdaptationProperties(content: any) {
        if (content["sap.fiori"]?.cloudDevAdaptationStatus) {
            delete content["sap.fiori"].cloudDevAdaptationStatus;
        }
        if (content["sap.ui5"] == null) {
            content["sap.ui5"] = {};
        }
        content["sap.ui5"].isCloudDevAdaptation = true;
    }


    static getManifestInfo(manifest: any) {
        const id = manifest["sap.app"]?.id as string;
        const version = manifest["sap.app"]?.applicationVersion?.version as string;
        return { id, version };
    }


    static renameBaseApp(baseAppFiles: Map<string, string>, search: string, replacement: string): Map<string, string> {
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
        const renamed = new Map();
        baseAppFiles.forEach((content: string, filepath: string) => {
            renamed.set(filepath, replaces.reduce((p, c) => p.replace(c.regexp, c.replacement), content));
        });
        return renamed;
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


    private static fillAppVariantIdHierarchy(processor: IProcessor, id: string, version: string, baseAppManifest: any) {
        log.verbose("Filling up app variant hierarchy in manifest.json");
        this.validateProperty(id, "sap.app/id");
        this.validateProperty(version, "sap.app/applicationVersion/version");
        if (baseAppManifest["sap.ui5"] == null) {
            baseAppManifest["sap.ui5"] = {};
        }
        if (baseAppManifest["sap.ui5"].appVariantIdHierarchy == null) {
            baseAppManifest["sap.ui5"].appVariantIdHierarchy = [];
        }
        const appVariantIdHierarchyItem = processor.createAppVariantHierarchyItem(id, version);
        baseAppManifest["sap.ui5"].appVariantIdHierarchy.unshift(appVariantIdHierarchyItem);
    }


    static validateProperty(value: string, property: string) {
        if (!value) {
            throw new Error(`Original application manifest should have ${property}`);
        }
    }


    static async applyDescriptorChanges(baseAppManifest: any, appVariantManifest: IAppVariantManifest, i18nBundleName: string) {
        log.verbose("Applying appVariant changes");
        const strategy = new BuildStrategy(RegistrationBuild, ApplyUtil, i18nBundleName);
        if (appVariantManifest.layer) {
            appVariantManifest.content?.forEach(item => item.layer = appVariantManifest.layer);
        }
        const changesContent = appVariantManifest.content?.map((change: IChange) => new Change(change));
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
            if (!IGNORE_FILES.includes(filename)) {
                const resource = resourceFactory.createResource({
                    path: getPath(filename, projectNamespace),
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