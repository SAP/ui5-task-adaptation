import ManifestRenamingHandler from "./handlers/manifestRenamingHandler.js";
import JsonRenamingHandler from "./handlers/jsonRenamingHandler.js";
import { stringToBuffer, bufferToString, bufferToJson, jsonToBuffer } from "../commonUtil.js";
import { getSAPUI5DependencyIds } from "../manifestUtil.js";
import { renameMap } from "./referenceRenaming.js";
import { TEXT_EXTENSIONS } from "../resourceUtil.js";
import { posix as path } from "path";


function isTextFile(filename: string): boolean {
    return TEXT_EXTENSIONS.has(path.extname(filename).slice(1));
}


function getManifestSAPUI5DependencyIds(files: ReadonlyMap<string, Buffer>) {
    const manifestFile = files.get("manifest.json");
    return manifestFile ? getSAPUI5DependencyIds(bufferToJson(manifestFile)) : [];
}


function getI18nPropertyKeys(files: ReadonlyMap<string, Buffer>) {
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


/**
 * Renames references (old id → adaptation project id) across all text files in
 * place, leaving i18n .properties files, their keys and SAPUI5 dependency ids
 * untouched.
 */
export default class FileRenamer {

    /**
     * 1p. i18n.properties are not renamed and property keys are ignored during
     * the renaming across the files. Stateless: does not use `this`.
     * @param files - all files both base and appVariants
     * @param references - Reference maps of the app variant
     */
    @restoreWhatShouldntBeRenamed()
    static rename(files: Map<string, Buffer>, references: Map<string, string>): void {
        const IGNORE_EXTENSIONS = [".properties"];
        const ignoreInString = [
            ...getI18nPropertyKeys(files),
            ...getManifestSAPUI5DependencyIds(files)
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
}

/**
 * Snapshots the JSON paths that must survive renaming (e.g.
 * sap.ui5/appVariantIdHierarchy, dependencies), runs the decorated method, then
 * restores them. The decorated method receives a Map of files (filename →
 * Buffer): every file a handler `accept`s is parsed, snapshotted before the
 * renaming and restored + written back after. Each matching file gets its own
 * handler instance so one file's snapshot can't clobber another's.
 */
export function restoreWhatShouldntBeRenamed() {
    return function (_target: any, _propertyKey: string, descriptor: PropertyDescriptor) {
        const handlerFactories = [() => new ManifestRenamingHandler()];
        const originalValue = descriptor.value;
        descriptor.value = function (...args: any[]) {
            const files = args[0] as Map<string, Buffer>;
            // Snapshot the protected paths with a dedicated handler instance per
            // file, so one file's snapshot can't clobber another's. Multiple
            // files can match a handler (e.g. the root manifest.json and a
            // nested cards/.../manifest.json both end with "manifest.json"); a
            // shared handler would let the last-snapshotted file (which may lack
            // appVariantIdHierarchy) wipe the root manifest's value on restore.
            const snapshots: Array<{ filename: string, handler: JsonRenamingHandler }> = [];
            for (const [filename, content] of files) {
                for (const createHandler of handlerFactories) {
                    const handler = createHandler();
                    if (handler.accept(filename)) {
                        handler.snapshot(bufferToJson(content));
                        snapshots.push({ filename, handler });
                    }
                }
            }
            originalValue.apply(this, args);
            for (const { filename, handler } of snapshots) {
                const content = files.get(filename);
                if (content) {
                    const json = bufferToJson(content);
                    handler.restore(json);
                    files.set(filename, jsonToBuffer(json));
                }
            }
            return files;
        };
    };
};
