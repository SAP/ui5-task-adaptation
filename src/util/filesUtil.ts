import { rename, getI18nPropertyKeys } from "./commonUtil.js";
import ManifestHandler from "./renamingHandlers/manifestHandler.js";
import { IRenamingHandler } from "./renamingHandlers/renamingHandler.js";

export default class FilesUtil {

    static filter(files: ReadonlyMap<string, string>): ReadonlyMap<string, string> {
        const result = new Map<string, string>();
        files.forEach((content, filename) => {
            if (!this.ignore(filename)) {
                result.set(filename, content);
            }
        });
        return result;
    }

    /**
     * Renames files in the base application substituting original id with
     * appVariant id. Renames all files except i18n properties files, when we
     * rename property keys of nested application variants we got in the end
     * multiple i18n properties with the same key, but different values. UI5
     * takes the first one which is the oldest but we need the latest most
     * recent updated one.
     * @param files - The files of the base application.
     * @param reference - The reference of the app variant (original/base app id).
     * @param id - The id of the app variant.
     * @returns A map of renamed files.
     */
    static rename(files: ReadonlyMap<string, string>, references: string[], adaptationProjectId: string): ReadonlyMap<string, string> {
        const handlers = [new ManifestHandler()] as Array<IRenamingHandler>;
        const IGNORE_EXTENSIONS = [".properties"];
        const ignoreInStrings = getI18nPropertyKeys(files);
        const renamedFiles = new Map<string, string>();
        for (const handler of handlers) {
            handler.before(files);
        }
        files.forEach((content, filename) => {
            if (!IGNORE_EXTENSIONS.some(ext => filename.endsWith(ext))) {
                content = rename(content, references, adaptationProjectId, ignoreInStrings);
            }
            renamedFiles.set(filename, content);
        });
        for (const handler of handlers) {
            handler.after(renamedFiles);
        }
        return renamedFiles;
    }

    private static ignore(filename: string): boolean {
        const IGNORE_FILES = ["manifest.appdescr_variant"];
        return filename.startsWith("changes/manifest/") || IGNORE_FILES.includes(filename);
    }
}
