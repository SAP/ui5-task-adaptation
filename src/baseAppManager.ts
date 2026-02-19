import { trimExtension } from "./util/commonUtil.js";

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

/**
 * Processes files to replace .js file content with corresponding -dbg.js
 * content and remove -dbg.js
 * @param files - Map of all files
 * @returns Map with .js files replaced by -dbg.js content where applicable
 */
export function preProcessFiles(files: ReadonlyMap<string, string>): Map<string, string> {
    const processedFiles = new Map(files);

    // Find all -dbg.js files that have corresponding .js files
    for (const [filename, content] of files) {
        if (filename.endsWith("-dbg.js")) {
            const correspondingJsFile = filename.replace("-dbg.js", ".js");
            if (files.has(correspondingJsFile)) {
                // Replace the .js file content with the -dbg.js content
                processedFiles.set(correspondingJsFile, content);
                processedFiles.delete(filename);
            }
        } else if (filename.endsWith("-dbg.js.map")) {
            const correspondingJsFile = filename.replace("-dbg.js.map", ".js");
            if (files.has(correspondingJsFile)) {
                processedFiles.delete(filename);
            }
        }
        if (IGNORE_FILES.some(ignoredFile => ignoredFile === filename)) {
            processedFiles.delete(filename);
        }
    }

    return processedFiles;
}

export default class BaseApp {

    readonly id: string;
    readonly version: string;
    readonly i18nPath: string;
    readonly files: ReadonlyMap<string, string>;


    static fromFiles(files: ReadonlyMap<string, string>) {
        return new BaseApp(files);
    }

    private constructor(files: ReadonlyMap<string, string>) {
        if (files.size === 0) {
            throw new Error("Original application sources are empty");
        }
        this.files = preProcessFiles(files);
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


    private VALIDATION_RULES = new Map([["sap.app/id", (value: string) => {
        if (!value.includes(".")) {
            // https://help.sap.com/docs/bas/developing-sap-fiori-app-in-sap-business-application-studio/releasing-sap-fiori-application-to-be-extensible-in-adaptation-projects-on-sap-s-4hana-cloud
            // In the manifest.json file, make sure that the attribute
            // sap.app/id has at least 2 segments.
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


}
