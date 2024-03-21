import { Applier, Change, RegistrationBuild } from "../dist/bundle.js";
import { IAppVariantInfo, IBaseAppInfo, IChange, IProjectOptions } from "./model/types.js";
import { dotToUnderscore, removePropertiesExtension } from "./util/commonUtil.js";

import BuildStrategy from "./buildStrategy.js";
import IProcessor from "./processors/processor.js";
import ResourceUtil from "./util/resourceUtil.js";
import { getLogger } from "@ui5/logger";
import { renameResources } from "./util/commonUtil.js";

const log = getLogger("@ui5/task-adaptation::BaseAppManager");

export interface IBaseAppResources {
    resources: any[];
    manifestInfo: IManifestInfo;
}

export interface IManifestIdVersion {
    id: string;
    version: string;
}

export interface IManifestInfo extends IManifestIdVersion {
    i18nPath: string;
}

export default class BaseAppManager {

    static async process(baseAppFiles: Map<string, string>, appVariantInfo: IAppVariantInfo, options: IProjectOptions, processor: IProcessor): Promise<IBaseAppResources> {
        const baseAppManifest = this.getBaseAppManifest(baseAppFiles);

        const { id, version } = this.getIdVersion(baseAppManifest.content);
        this.validateProperty(id, "sap.app/id");
        this.validateProperty(version, "sap.app/applicationVersion/version");

        const renamedBaseAppFiles = renameResources(baseAppFiles, appVariantInfo.reference, appVariantInfo.id);
        const { filepath, content } = this.getBaseAppManifest(renamedBaseAppFiles);
        await processor.updateLandscapeSpecificContent(content, renamedBaseAppFiles);
        this.fillAppVariantIdHierarchy(processor, id, version, content);
        this.updateAdaptationProperties(content);
        await this.applyDescriptorChanges(content, appVariantInfo);
        renamedBaseAppFiles.set(filepath, JSON.stringify(content));

        return {
            resources: this.writeToWorkspace(renamedBaseAppFiles, options.projectNamespace),
            manifestInfo: this.getManifestInfo(content)
        }
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

    static getIdVersion(manifest: any): IManifestIdVersion {
        const id = manifest["sap.app"]?.id as string;
        const version = manifest["sap.app"]?.applicationVersion?.version as string;
        return { id, version };
    }

    static getManifestInfo(manifest: any): IManifestInfo {
        const { id, version } = this.getIdVersion(manifest);
        const i18nNode = manifest["sap.app"]?.i18n;
        const i18nPath = this.extractI18nPathFromManifest(id, i18nNode);
        return { id, version, i18nPath };
    }

    private static extractI18nPathFromManifest(sapAppId: string, i18nNode: any) {
        if (typeof i18nNode === "object") {
            return i18nNode["bundleUrl"] ? this.extractI18NFromBundleUrl(i18nNode) : this.extractI18NFromBundleName(i18nNode, sapAppId);
        } else {
            return `${sapAppId?.replaceAll(".", "/")}/${i18nNode}`;
        }
    }

    private static extractI18NFromBundleName(i18nNode: any, sapAppId: string) {
        return i18nNode["bundleName"].replace(sapAppId, "").replaceAll(".", "/").substring(1);
    }

    private static extractI18NFromBundleUrl(i18nNode: any) {
        return removePropertiesExtension(i18nNode["bundleUrl"]);
    }

    private static getBaseAppManifest(baseAppFiles: Map<string, string>): IBaseAppInfo {
        const manifestContent = baseAppFiles.get("manifest.json");
        if (manifestContent) {
            return {
                content: JSON.parse(manifestContent),
                filepath: "manifest.json"
            }
        }
        throw new Error("Original application should have manifest.json in root folder");
    }


    private static fillAppVariantIdHierarchy(processor: IProcessor, id: string, version: string, baseAppManifest: any) {
        log.verbose("Filling up app variant hierarchy in manifest.json");
        if (baseAppManifest["sap.ui5"] == null) {
            baseAppManifest["sap.ui5"] = {};
        }
        if (baseAppManifest["sap.ui5"].appVariantIdHierarchy == null) {
            baseAppManifest["sap.ui5"].appVariantIdHierarchy = [];
        }
        const appVariantIdHierarchyItem = processor.createAppVariantHierarchyItem(id, version);
        baseAppManifest["sap.ui5"].appVariantIdHierarchy.unshift(appVariantIdHierarchyItem);
    }


    private static VALIDATION_RULES = new Map([["sap.app/id", (value: string) => {
        if (!value.includes(".")) {
            throw new Error(`The original application id '${value}' should consist of multiple segments split by dot, e.g.: original.id`);
        }
    }]]);


    static validateProperty(value: string, property: string) {
        if (!value) {
            throw new Error(`Original application manifest should have ${property}`);
        }
        let validatationRule = this.VALIDATION_RULES.get(property);
        if (validatationRule) {
            validatationRule(value);
        }
    }


    static async applyDescriptorChanges(baseAppManifest: any, { layer, changes, id }: IAppVariantInfo) {
        log.verbose("Applying appVariant changes");
        const changesContent = new Array<Change>();
        const i18nBundleName = dotToUnderscore(id);
        for (const change of structuredClone(changes)) {
            if (layer) {
                change.layer = layer;
            }
            changesContent.push(new Change(change));
            this.adjustAddNewModelEnhanceWith(change, i18nBundleName);
        }
        if (changesContent.length > 0) {
            const strategy = new BuildStrategy(RegistrationBuild);
            await Applier.applyChanges(baseAppManifest, changesContent, strategy);
        }
    }


    private static adjustAddNewModelEnhanceWith(change: IChange, i18nBundleName: string) {
        if (change.changeType === "appdescr_ui5_addNewModelEnhanceWith") {
            if (change.texts == null) {
                // We need to add texts properties to changes because not all
                // have texts property. Changes without texts property can
                // causes issues in bundle.js This is needed for now, and will
                // be removed as soon as change merger in openUI5 is updated
                change.texts = { i18n: change.content?.bundleUrl || "i18n/i18n.properties" };
            }
            change.texts.i18n = i18nBundleName + "/" + change.texts.i18n;
        }
    }


    static writeToWorkspace(baseAppFiles: Map<string, string>, projectNamespace: string) {
        const IGNORE_FILES = [
            "manifest-bundle.zip",
            "Component-preload.js",
            "sap-ui-cachebuster-info.json"
        ];
        const resources = [];
        for (let filename of baseAppFiles.keys()) {
            if (!IGNORE_FILES.includes(filename)) {
                const resource = ResourceUtil.createResource(filename,
                    projectNamespace, baseAppFiles.get(filename)!);
                resources.push(resource);
            }
        }
        return resources;
    }
}
