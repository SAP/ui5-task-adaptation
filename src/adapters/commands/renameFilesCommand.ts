import ManifestRenamingHandler from "../../util/renamingHandlers/manifestRenamingHandler.js";
import JsonRenamingHandler from "../../util/renamingHandlers/jsonRenamingHandler.js";
import { stringToBuffer, bufferToString, bufferToJson, jsonToBuffer } from "../../util/commonUtil.js";
import { renameMap } from "../../util/renamingUtil.js";
import { TEXT_EXTENSIONS } from "../../util/resourceUtil.js";
import { posix as path } from "path";
import { PostCommand } from "./command.js";


function isTextFile(filename: string): boolean {
    return TEXT_EXTENSIONS.has(path.extname(filename).slice(1));
}


export default class RenameFilesCommand extends PostCommand {
    constructor(private references: Map<string, string>) {
        super();
    }

    async execute(files: Map<string, Buffer>): Promise<void> {
        this.rename(files, this.references);
    }


    /**
         * 1p. i18n.properties are not renamed and property keys are ignored during
         * the renaming across the files.
         * @param files - all files both base and appVariants
         * @param references - Reference maps of the app variant
         * @returns A map of renamed files
         */
    @restoreWhatShouldntBeRenamed()
    rename(files: Map<string, Buffer>, references: Map<string, string>): void {
        const IGNORE_EXTENSIONS = [".properties"];
        const ignoreInString = [
            ...this.getI18nPropertyKeys(files),
            ...this.getManifestSAPUI5DependencyIds(files)
        ];
        const updates = new Map<string, Buffer>();
        for (const [filename, content] of files) {
            if (!isTextFile(filename)) {
                continue;
            }
            if (!IGNORE_EXTENSIONS.some(ext => filename.endsWith(ext))) {
                // 5p. We pass replacements as ignores since we don't want to
                // rename them again. E.g. we replace app.id with
                // customer.app.id, but if we found customer.app.id somewhere,
                // because we applied changes or something, we don't want to
                // rename it again to customer.customer.app.id.
                const renamed = renameMap(bufferToString(content), references, [...references.values(), ...ignoreInString]);
                updates.set(filename, stringToBuffer(renamed));
            }
        }
        for (const [filename, content] of updates) {
            files.set(filename, content);
        }
    }

    private getManifestSAPUI5DependencyIds(files: ReadonlyMap<string, Buffer>) {
        const manifestFile = files.get("manifest.json");
        if (manifestFile) {
            const manifest = bufferToJson(manifestFile);
            const dependencies = manifest["sap.ui5"]?.dependencies;
            if (dependencies) {
                const libs = dependencies.libs ? Object.keys(dependencies.libs) : [];
                const components = dependencies.components ? Object.keys(dependencies.components) : [];
                return [...libs, ...components];
            }
        }
        return [];
    }

    private getI18nPropertyKeys(files: ReadonlyMap<string, Buffer>) {
        const keys = new Set<string>();
        files.forEach((content, filename) => {
            if (filename.endsWith(".properties")) {
                const lines = bufferToString(content).split("\n").filter(line => !line.startsWith("#"));
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
 * We might rename appVariantIdHierarchy and dependencies, so we restore them after the renaming.
 *
 * The decorated method may receive either a Map of files (filename → Buffer) or
 * a plain JSON object. Each handler is responsible for a single file (via its
 * `accept`), operating on its parsed JSON content:
 *  - Map case: every file a handler accepts is parsed, snapshotted before the
 *    renaming, then restored and written back after.
 *  - JSON case: the object is mutated in-place (its reference is preserved) and
 *    every handler is applied to it.
 */
export function restoreWhatShouldntBeRenamed() {
    return function (_target: any, _propertyKey: string, descriptor: PropertyDescriptor) {
        const handlers = [new ManifestRenamingHandler()] as Array<JsonRenamingHandler>;
        const originalValue = descriptor.value;
        descriptor.value = function (...args: any[]) {
            const renaming = args[0];
            const files = renaming as Map<string, Buffer>;
            forEachAccepted(files, handlers, (handler, content) => handler.before(bufferToJson(content)));
            originalValue.apply(this, args);
            forEachAccepted(files, handlers, (handler, content, filename) => {
                const json = bufferToJson(content);
                handler.after(json);
                files.set(filename, jsonToBuffer(json));
            });
            return files;
        };
    };
};

/**
 * Parses each file that at least one handler accepts, hands the JSON to the
 * given callback along with the accepting handlers, and — when `writeBack` is
 * provided — serializes the (possibly mutated) JSON back into that map.
 */
function forEachAccepted(
    files: ReadonlyMap<string, Buffer>,
    handlers: Array<JsonRenamingHandler>,
    callback: (handler: JsonRenamingHandler, content: Buffer, filename: string) => void,
): void {
    for (const [filename, content] of files) {
        for (const handler of handlers) {
            if (handler.accept(filename)) {
                callback(handler, content, filename);
            }
        }
    }
}
