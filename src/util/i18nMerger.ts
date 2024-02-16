import { dotToUnderscore, escapeRegex, removePropertiesExtension } from "./commonUtil";

import { IAppVariantInfo } from "../model/types";
import ResourceUtil from "./resourceUtil";
import { posix as path } from "path";

const Resource = require("@ui5/fs/lib/Resource");

export default class I18NMerger {

    static analyzeAppVariantManifestChanges(rootFolder: string, tranlsationRegexPattern: string, { changes }: IAppVariantInfo) {
        // check which files need to be copied and which files need to be merged and copied
        // this is necessary because lrep does not support multiple enhanceWith with multiple locations
        const mergePaths = new Set<RegExp>();
        const copyPaths = new Set<RegExp>();
        changes.forEach((change) => {
            const i18nPathWithExtension = change.content?.bundleUrl || change.texts?.i18n;
            if (i18nPathWithExtension) {
                // build regex to match specific + language related files
                const i18nPath = removePropertiesExtension(i18nPathWithExtension);
                const resourcePath = path.join(rootFolder, i18nPath);
                const regex = new RegExp(escapeRegex(resourcePath) + tranlsationRegexPattern);
                if (change.changeType.includes("addNewModelEnhanceWith")) {
                    copyPaths.add(regex);
                } else {
                    mergePaths.add(regex);
                }
            }
        });
        return { mergePathsRegex: [...mergePaths.values()], copyPathsRegex: [...copyPaths.values()] };
    }


    static async mergeI18NFiles(baseAppResources: any[], appVariantResources: any[], projectNamespace: string, baseAppManifestI18NPath: string, appVariantInfo: IAppVariantInfo, taskUtil: any) {
        const aggregatedResourceFilesMap = new Map<string, typeof Resource>(baseAppResources.map(baseAppResource => [baseAppResource.getPath(), baseAppResource]));
        const i18nTargetFolder = dotToUnderscore(appVariantInfo.id);
        const rootFolder = ResourceUtil.getRootFolder(projectNamespace);
        const tranlsationRegexPattern = "((_[a-z]{2,3})?(_[a-zA-Z]{2,3}(_[a-zA-Z]{2,20})?)?)\.properties$";
        const { copyPathsRegex: copyPathsValues, mergePathsRegex: mergePathsValues } = this.analyzeAppVariantManifestChanges(rootFolder, tranlsationRegexPattern, appVariantInfo);
        for (const appVariantResource of appVariantResources) {
            const appVariantResourcePath = appVariantResource.getPath();
            if (appVariantResourcePath.endsWith(".properties")) {
                // merge/copy logic
                // check if file matches with regex in merge/copy
                const mergePathMatch = mergePathsValues.map(path => appVariantResourcePath.match(path)).find(match => match);
                const shouldMergeFile = !!mergePathMatch;
                const shouldCopyFile = copyPathsValues.map(path => appVariantResourcePath.match(path)).find(match => match);

                if (shouldMergeFile) {
                    let baseAppI18NPath = `${rootFolder}/${baseAppManifestI18NPath}${mergePathMatch[1] || ""}.properties`;
                    await this.mergePropertiesFiles(aggregatedResourceFilesMap, appVariantResource, baseAppI18NPath);
                }

                // Resource for to be copied file already exists so we only have to adjust path
                // Otherwise we have to omit it. We always change the path to avoid omitting a base app file
                this.moveToAppVarSubfolder(appVariantResource, rootFolder, i18nTargetFolder);
                if (!shouldCopyFile) {
                    taskUtil.setTag(appVariantResource, taskUtil.STANDARD_TAGS.OmitFromBuildResult, true);
                }
            }
            aggregatedResourceFilesMap.set(appVariantResource.getPath(), appVariantResource);
        }
        return Array.from(aggregatedResourceFilesMap.values());
    }


    /**
     *  Merge/Append base property file with property file from app variant
     * FIXME Currently merge could duplicate keys which causes undefined
     * behavior => Existing keys which are in merge content must be removed =>
     * Actually only descriptor texts are relevant for merge which always have
     * app variant Id as prefix => If we filter on them we do not need to remove
     * existing overwritten keys (as there should be none)
     */
    private static async mergePropertiesFiles(aggregatedResourceFilesMap: Map<string, typeof Resource>, variantResource: typeof Resource, baseAppI18NPath: string) {
        const baseAppI18NFile = aggregatedResourceFilesMap.get(baseAppI18NPath);
        if (baseAppI18NFile) {
            await this.mergeFiles(baseAppI18NFile, variantResource);
        } else {
            // create the merge target file if it missing in base app. Maybe the language does not exist in the base app.
            // Since the file might also be copied we do not just change the path of it but create another resource
            await this.createFile(aggregatedResourceFilesMap, baseAppI18NPath, variantResource);
        }
    }


    /**
     * update the path of app variant property file so it will be copied into
     <app_variant_id> folder
     */
    private static moveToAppVarSubfolder(variantResource: typeof Resource, rootFolder: string, i18nBundleName: string) {
        const relativeFilePath = variantResource.getPath().substring(rootFolder.length);
        const newResourcePath = path.join(rootFolder, i18nBundleName, relativeFilePath);
        variantResource.setPath(newResourcePath);
    }


    /**
     * create new i18n file in case e.g. translation file does not exist in base
     * app but in variant and copy of translation file is needed
     */
    private static async createFile(aggregatedResourceFilesMap: Map<string, typeof Resource>, path: string, resource: typeof Resource) {
        const createdFile = await resource.clone();
        createdFile.setPath(path);
        aggregatedResourceFilesMap.set(path, createdFile);
    }


    private static async mergeFiles(baseFile: typeof Resource, variantFile: typeof Resource) {
        const variantFileContent = await variantFile.getString();
        const mergedFileContent = await baseFile.getString();
        baseFile.setString(`${mergedFileContent}\n\n#App variant specific text file\n\n${variantFileContent}`);
    }
}