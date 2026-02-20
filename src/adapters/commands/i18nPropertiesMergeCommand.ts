import { escapeRegex, trimExtension } from "../../util/commonUtil.js";
import { IChange } from "../../model/types.js";
import { posix as path } from "path";
import { MergeCommand } from "./command.js";

export default class I18nPropertiesMergeCommand extends MergeCommand {

    private mergePaths: RegExp[];
    private copyPaths: RegExp[];

    constructor(private i18nPath: string, private prefix: string, manifestChanges: ReadonlyArray<IChange>) {
        super();
        const { mergePaths, copyPaths } = this.analyzeAppVariantManifestChanges(manifestChanges);
        this.mergePaths = mergePaths;
        this.copyPaths = copyPaths;
    }

    accept = (filename: string) => filename.endsWith(".properties");

    
    private analyzeAppVariantManifestChanges(manifestChanges: ReadonlyArray<IChange>) {
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
    
    
    async execute(files: Map<string, string>, filename: string, appVariantContent: string): Promise<void> {
        // merge/copy logic
        // check if file matches with regex in merge/copy
        const mergePathMatch = this.mergePaths.map(path => filename.match(path)).find(match => match);
        const copyPathMatch = this.copyPaths.map(path => filename.match(path)).find(match => match);
        if (mergePathMatch) {
            this.mergePropertiesFiles(files, this.i18nPath, appVariantContent, mergePathMatch[1]);
        }
        if (copyPathMatch) {
            files.set(path.join(this.prefix, filename), appVariantContent);
        }
    }

    /**
     * Filters out specific lines from the given string.
     * Removes lines matching:
     * - __ldi.translation.uuid\s*=\s*(.*)
     * - ABAP_TRANSLATION
     * - SAPUI5 TRANSLATION-KEY
     */
    private filterTranslationMetaLines(content: string): string {
        const lines = content.split('\n');
        const filtered = lines.filter(
            line =>
                !/^# __ldi\.translation\.uuid\s*=/.test(line) &&
                !line.startsWith("# ABAP_TRANSLATION") &&
                !line.startsWith("# SAPUI5 TRANSLATION-KEY")
        );
        return filtered.join('\n');
    }

    /**
     *  Merge/Append base property file with property file from app variant
     * FIXME Currently merge could duplicate keys which causes undefined
     * behavior => Existing keys which are in merge content must be removed =>
     * Actually only descriptor texts are relevant for merge which always have
     * app variant Id as prefix => If we filter on them we do not need to remove
     * existing overwritten keys (as there should be none)
     */
    private mergePropertiesFiles(files: Map<string, string>, i18nPath: string, appVariantFileContent: string, language: string = "") {
        const baseAppI18nPath = i18nPath + language + ".properties";
        const baseAppFileContent = files.get(baseAppI18nPath);
        const filteredBaseContent = baseAppFileContent ? this.filterTranslationMetaLines(baseAppFileContent) : "";
        const content = filteredBaseContent
            ? `${filteredBaseContent}\n\n#App variant specific text file\n\n${appVariantFileContent}`
            : appVariantFileContent;
        files.set(baseAppI18nPath, content);
    }

}
