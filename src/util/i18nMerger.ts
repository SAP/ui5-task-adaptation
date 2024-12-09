import { dotToUnderscore, escapeRegex, trimExtension } from "./commonUtil.js";

import AppVariant from "../appVariantManager.js";
import { IChange } from "../model/types.js";
import { posix as path } from "path";

export default class FileMerger {

    static analyzeAppVariantManifestChanges(manifestChanges: ReadonlyArray<IChange>) {
        // check which files need to be copied and which files need to be merged and copied
        // this is necessary because lrep does not support multiple enhanceWith with multiple locations
        const TRANSLATION_REGEX_PATTERN = "((_[a-z]{2,3})?(_[a-zA-Z]{2,3}(_[a-zA-Z]{2,20})?)?)\.properties$";
        const mergePaths = new Set<RegExp>();
        const copyPaths = new Set<RegExp>();
        manifestChanges.forEach((change) => {
            const i18nPathWithExtension = change.content?.bundleUrl || change.texts?.i18n;
            if (i18nPathWithExtension) {
                // build regex to match specific + language related files
                const i18nPath = trimExtension(i18nPathWithExtension);
                const regex = new RegExp("^" + escapeRegex(i18nPath) + TRANSLATION_REGEX_PATTERN);
                if (change.changeType.includes("addNewModelEnhanceWith")) {
                    copyPaths.add(regex);
                } else {
                    mergePaths.add(regex);
                }
            }
        });
        return { mergePaths: Array.from(mergePaths), copyPaths: Array.from(copyPaths) };
    }


    static merge(baseAppFiles: ReadonlyMap<string, string>, i18nPath: string, appVariant: AppVariant): Map<string, string> {
        const i18nTargetFolder = dotToUnderscore(appVariant.id);
        const { copyPaths, mergePaths } = this.analyzeAppVariantManifestChanges(appVariant.getProcessedManifestChanges());
        const files = new Map<string, string>(baseAppFiles);
        for (const [filename, content] of Array.from(appVariant.getProcessedFiles())) {
            if (filename.endsWith(".properties")) {
                // merge/copy logic
                // check if file matches with regex in merge/copy
                const mergePathMatch = mergePaths.map(path => filename.match(path)).find(match => match);
                const copyPathMatch = copyPaths.map(path => filename.match(path)).find(match => match);
                if (mergePathMatch) {
                    this.mergePropertiesFiles(files, i18nPath, content, mergePathMatch[1]);
                }
                if (copyPathMatch) {
                    files.set(path.join(i18nTargetFolder, filename), content);
                }
            } else {
                files.set(filename, content);
            }
        }
        return files;
    }


    /**
     *  Merge/Append base property file with property file from app variant
     * FIXME Currently merge could duplicate keys which causes undefined
     * behavior => Existing keys which are in merge content must be removed =>
     * Actually only descriptor texts are relevant for merge which always have
     * app variant Id as prefix => If we filter on them we do not need to remove
     * existing overwritten keys (as there should be none)
     */
    private static mergePropertiesFiles(files: Map<string, string>, i18nPath: string, appVariantFileContent: string, language: string = "") {
        let baseAppI18nPath = i18nPath + language + ".properties";
        const baseAppFileContent = files.get(baseAppI18nPath);
        const content = baseAppFileContent
            ? `${baseAppFileContent}\n\n#App variant specific text file\n\n${appVariantFileContent}`
            : appVariantFileContent;
        files.set(baseAppI18nPath, content);
    }

}
