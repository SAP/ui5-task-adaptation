import { renameMap } from "./renamingUtil.js";
import ManifestRenamingHandler from "./renamingHandlers/manifestRenamingHandler.js";
import { IRenamingHandler } from "./renamingHandlers/renamingHandler.js";

export default class FilesUtil {

    static filter(files: ReadonlyMap<string, string>): ReadonlyMap<string, string> {
        const shouldIgnore = (filename: string, content: string): boolean => {
            const IGNORE_FILES = ["manifest.appdescr_variant"];
            if( filename.endsWith(".change") ) {
                return JSON.parse(content).changeType?.startsWith("appdescr_"); // validate JSON
            }
            return IGNORE_FILES.includes(filename);
        }
        const result = new Map<string, string>();
        files.forEach((content, filename) => {
            if (!shouldIgnore(filename, content)) {
                result.set(filename, content);
            }
        });
        return result;
    }

    /**
     * 1p. i18n.properties are not renamed and property keys are ignored during
     * the renaming across the files.
     * @param files - all files both base and appVariants
     * @param references - Reference maps of the app variant
     * @returns A map of renamed files
     */
    @restoreThatShouldntBeRenamed()
    static rename(files: ReadonlyMap<string, string>, references: Map<string, string>): ReadonlyMap<string, string> {
        const IGNORE_EXTENSIONS = [".properties"];
        const ignoreInString = this.getI18nPropertyKeys(files);
        return new Map(Array.from(files, ([filename, content]) => {
            if (!IGNORE_EXTENSIONS.some(ext => filename.endsWith(ext))) {
                // 5p. We pass replacements as ignores since we don't want to
                // rename them again. E.g. we replace app.id with
                // customer.app.id, but if we found customer.app.id somewhere,
                // because we applied changes or something, we don't want to
                // rename it again to customer.customer.app.id.
                content = renameMap(content, references, [...references.values(), ...ignoreInString]);
            }
            return [filename, content];
        }));
    }

    private static getI18nPropertyKeys(files: ReadonlyMap<string, string>) {
        const keys = new Set<string>();
        files.forEach((content, filename) => {
            if (filename.endsWith(".properties")) {
                const lines = content.split("\n").filter(line => !line.startsWith("#"));
                for (const line of lines) {
                    const [key] = line.split("=");
                    if (key) {
                        keys.add(key);
                    }
                }
            }
        })
        return [...keys];
    }
}

/** 
 * We might rename appVariantIdHierarchy, so we restore it after the renaming.
 */
export function restoreThatShouldntBeRenamed() {
    return function (_target: any, _propertyKey: string, descriptor: PropertyDescriptor) {
        const handlers = [new ManifestRenamingHandler()] as Array<IRenamingHandler>;
        const originalValue = descriptor.value;
        descriptor.value = function (...args: any[]) {
            handlers.forEach(handler => handler.before(args[0]));
            const renamedFiles = originalValue.apply(this, args);
            handlers.forEach(handler => handler.after(renamedFiles));
            return renamedFiles;
        };
    };
};
