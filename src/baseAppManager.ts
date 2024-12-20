import { Applier, Change, RegistrationBuild } from "../dist/bundle.js";
import { dotToUnderscore, trimExtension } from "./util/commonUtil.js";

import AppVariant from "./appVariantManager.js";
import BuildStrategy from "./buildStrategy.js";
import { IChange } from "./model/types.js";
import IProcessor from "./processors/processor.js";
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

const IGNORE_FILES = [
    "manifest-bundle.zip",
    "Component-preload.js",
    "sap-ui-cachebuster-info.json"
];

export default class BaseApp {

    readonly id: string;
    readonly version: string;
    readonly i18nPath: string;
    readonly files: ReadonlyMap<string, string>;


    static fromFiles(files: ReadonlyMap<string, string>) {
        return new BaseApp(files);
    }

    private constructor(files: ReadonlyMap<string, string>) {
        this.files = new Map([...files].filter(([filename]) => !IGNORE_FILES.includes(filename)));
        const manifestString = files.get("manifest.json");
        if (!manifestString) {
            throw new Error("Original application should have manifest.json in root folder");
        }
        const manifest = JSON.parse(manifestString);
        this.id = manifest["sap.app"]?.id as string;
        this.version = manifest["sap.app"]?.applicationVersion?.version as string;
        this.validateProperty(this.id, "sap.app/id");
        this.validateProperty(this.version, "sap.app/applicationVersion/version");
        this.i18nPath = this.extractI18nPathFromManifest(this.id, manifest["sap.app"]?.i18n);
    }

    async adapt(appVariant: AppVariant, processor: IProcessor): Promise<ReadonlyMap<string, string>> {
        const files = renameResources(this.files, appVariant.reference, appVariant.id);
        const manifest = JSON.parse(files.get("manifest.json")!);
        await processor.updateLandscapeSpecificContent(manifest, files);
        this.fillAppVariantIdHierarchy(processor, this.id, this.version, manifest);
        this.updateAdaptationProperties(manifest);
        await this.applyDescriptorChanges(manifest, appVariant);
        files.set("manifest.json", JSON.stringify(manifest));
        return files;
    }

    private updateAdaptationProperties(content: any) {
        if (content["sap.fiori"]?.cloudDevAdaptationStatus) {
            delete content["sap.fiori"].cloudDevAdaptationStatus;
        }
        if (content["sap.ui5"] == null) {
            content["sap.ui5"] = {};
        }
        content["sap.ui5"].isCloudDevAdaptation = true;
    }


    private extractI18nPathFromManifest(sapAppId: string, i18nNode: any) {
        if (i18nNode) {
            if (i18nNode["bundleUrl"]) {
                return trimExtension(i18nNode["bundleUrl"]);
            } else if (i18nNode["bundleName"]) {
                return i18nNode["bundleName"].replace(sapAppId, "").replaceAll(".", "/").substring(1);
            } else if (typeof i18nNode === "string") {
                return trimExtension(i18nNode);
            }
        }
        return "i18n/i18n";
    }


    private fillAppVariantIdHierarchy(processor: IProcessor, id: string, version: string, baseAppManifest: any) {
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


    private VALIDATION_RULES = new Map([["sap.app/id", (value: string) => {
        if (!value.includes(".")) {
            throw new Error(`The original application id '${value}' should consist of multiple segments split by dot, e.g.: original.id`);
        }
    }]]);


    private validateProperty(value: string, property: string) {
        if (!value) {
            throw new Error(`Original application manifest should have ${property}`);
        }
        let validatationRule = this.VALIDATION_RULES.get(property);
        if (validatationRule) {
            validatationRule(value);
        }
    }


    private async applyDescriptorChanges(baseAppManifest: any, appVariant: AppVariant) {
        log.verbose("Applying appVariant changes");
        const changesContent = new Array<Change>();
        const i18nBundleName = dotToUnderscore(appVariant.id);
        for (const change of appVariant.getProcessedManifestChanges()) {
            changesContent.push(new Change(change));
            this.adjustAddNewModelEnhanceWith(change, i18nBundleName);
        }
        if (changesContent.length > 0) {
            const strategy = new BuildStrategy(RegistrationBuild);
            await Applier.applyChanges(baseAppManifest, changesContent, strategy);
        }
    }


    private adjustAddNewModelEnhanceWith(change: IChange, i18nBundleName: string) {
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
}
