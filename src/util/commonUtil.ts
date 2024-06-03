import * as Log from "@ui5/logger";
import * as fs from "fs";

import { IConfiguration } from "../model/types.js";
import Language from "../model/language.js";
import { fileURLToPath } from "url";
import { posix as path } from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const log = Log.getLogger("rollup-plugin-ui5-resolve-task-adaptation");


export function dotToUnderscore(value: string) {
    return value.replace(/\./g, "_");
}


export function validateObject<T extends Object>(options: T, properties: Array<keyof T>, message: string) {
    for (const property of properties) {
        if (!options[property]) {
            throw new Error(`'${String(property)}' ${message}`);
        }
    }
}

export function escapeRegex(update: string) {
    return update.replaceAll(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
}

export function renameResources(files: Map<string, string>, search: string, replacement: string): Map<string, string> {
    // The current regex works if the old Id is contained in the new Id, given
    // that they do not have the same beginning.
    // more complete alternative: /((?<!newIdStart)|(?!newIdEnd))oldId/g
    let escapedSearch: string;
    if (replacement.includes(search)) {
        const [before] = replacement.split(search);
        // Matches a position in the string that is not immediately preceded by
        // the string "before". Since we won't replace anyway, we should also
        // ignore one with the slashes.
        const escapedBefore = escapeRegex(before).replaceAll("\\.", "[\\./]");
        escapedSearch = `(?<!${escapedBefore})${escapeRegex(search)}`;
    } else {
        escapedSearch = escapeRegex(search);
    }

    const dotToSlash = (update: string) => update.replaceAll(".", "\/");
    const replaces = [
        {
            regexp: new RegExp(escapedSearch, "g"),
            replacement
        },
        {
            regexp: new RegExp(dotToSlash(escapedSearch), "g"),
            replacement: dotToSlash(replacement)
        }
    ];
    files.forEach((content: string, filepath: string, map: Map<string, string>) => {
        map.set(filepath, replaces.reduce((p, c) => p.replace(c.regexp, c.replacement), content));
    });

    return files;
}

export function insertInArray<T>(array: T[], index: number, insert: T) {
    array.splice(index, 0, insert);
}

export function writeTempAnnotations({ writeTempFiles }: IConfiguration, name: string, language: Language, content: string) {
    const TEMP_DIST_FOLDER = path.join(process.cwd(), "dist-debug", name);
    if (writeTempFiles) {
        if (!fs.existsSync(TEMP_DIST_FOLDER)) {
            fs.mkdirSync(TEMP_DIST_FOLDER, { recursive: true });
        }
        if (language) {
            name += "-" + language.i18n;
        }
        fs.writeFileSync(path.join(TEMP_DIST_FOLDER, name + ".xml"), content);
    }
}

export function removePropertiesExtension(filePath: string) {
    const lastIndexOf = filePath.lastIndexOf(".properties");
    return filePath.substring(0, lastIndexOf);
}

export function traverse(json: any, paths: string[], callback: (json: any, key: string | number, paths: string[]) => void) {
    for (const key of Object.keys(json)) {
        const internPaths = [...paths];
        internPaths.push(key);
        if (typeof json[key] === "object") {
            if (Array.isArray(json[key])) {
                const array = json[key];
                for (let i = 0; i < array.length; i++) {
                    if (typeof array[i] === "object") {
                        traverse(array[i], internPaths, callback);
                    } else {
                        callback(array, i, internPaths);
                    }
                }
            } else {
                traverse(json[key], internPaths, callback);
            }
        } else {
            callback(json, key, internPaths);
        }
    }
}

export function logBuilderVersion() {
    try {
        const packageJson = fs.readFileSync(path.join(__dirname, "../../package.json"), { encoding: "utf-8" });
        const packageJsonVersion = JSON.parse(packageJson).version;
        log.info(`Running app-variant-bundler-build with version ${packageJsonVersion}`);
    } catch (e: any) {
        // do nothing
    }
}

export function logBetaUsage() {
    log.info("Beta features enabled");
}

export function getUniqueName(existingNames: string[], template: string) {
    let suffix = -1;
    let suffixString;
    do {
        suffixString = suffix === -1 ? "" : suffix;
        suffix++;
    } while (existingNames.includes(template + suffixString));
    return template + suffixString;
}
