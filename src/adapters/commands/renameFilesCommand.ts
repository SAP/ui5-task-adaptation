import ManifestRenamingHandler from "../../util/renamingHandlers/manifestRenamingHandler.js";
import { IRenamingHandler } from "../../util/renamingHandlers/renamingHandler.js";
import { stringToBuffer, bufferToString } from "../../util/commonUtil.js";
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
            const manifest = JSON.parse(bufferToString(manifestFile));
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
 */
export function restoreWhatShouldntBeRenamed() {
    return function (_target: any, _propertyKey: string, descriptor: PropertyDescriptor) {
        const handlers = [new ManifestRenamingHandler()] as Array<IRenamingHandler>;
        const originalValue = descriptor.value;
        descriptor.value = function (...args: any[]) {
            const files = args[0] as Map<string, Buffer>;
            const references = args[1] as Map<string, string>;
            handlers.forEach(handler => handler.before(files));
            originalValue.apply(this, [files, references]);
            handlers.forEach(handler => handler.after(files));
            return files;
        };
    };
};
