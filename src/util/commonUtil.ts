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


export function validateObject<T extends object>(options: T, properties: Array<keyof T>, message: string) {
    for (const property of properties) {
        if (!options[property]) {
            throw new Error(`'${String(property)}' ${message}`);
        }
    }
}

export function escapeRegex(update: string) {
    return update.replaceAll(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
}


export function renameResources(files: ReadonlyMap<string, string>, search: string[], replacement: string, ignoreInStrings: string[] = []): Map<string, string> {
    return new Map([...files].map(([filepath, content]) => [filepath, rename(content, search, replacement, ignoreInStrings)]));
}


export function rename(content: string, searchTerms: string[], replacement: string, ignoreInStrings: string[] = []): string {
    type Interval = {
        start: number;
        end: number;
    }

    type Index = {
        i: number;
        replacement: string;
        searchTerm: string;
        inBetween?: Interval;
    }

    if (replacement.includes(".") && !searchTerms.some(searchTerm => searchTerm.includes("."))) {
        throw new Error("Ambiguous reference and appVariantId: both should contains dots or both should not contain dots.");
    }

    if (!content || !searchTerms || searchTerms.length === 0) {
        return content;
    }

    const dotToSlash = (str: string) => str.replaceAll(".", "\/");
    const replacementSlash = dotToSlash(replacement);

    // We don't want to replace in adaptation project ids
    ignoreInStrings.push(replacement);
    ignoreInStrings.push(replacementSlash);

    let start = 0;
    while (true) {
        // If we don't replace some strings in the content - we find all of them
        // and then don't replace inside their start and end indices.
        const ignoredStrings = ignoreInStrings.map(string => {
            return findAllOccurrences(content, string, start).map(i => ({ start: i, end: i + string.length }));
        }).filter(arr => arr.length > 0) || [] as Interval[][];

        // We find the next search index with dots and slashes. Then we replace
        // the nearest one and start search again in the next loop step.
        const indices = new Array<Index>();
        for (const searchTerm of searchTerms) {
            const searchTermSlash = dotToSlash(searchTerm);
            indices.push({
                i: content.indexOf(searchTerm, start),
                replacement,
                searchTerm
            });
            indices.push({
                i: content.indexOf(searchTermSlash, start),
                replacement: replacementSlash,
                searchTerm: searchTermSlash
            });
        }

        const found = indices.filter(({ i }) => i > -1);
        if (found.length === 0) {
            return content;
        }

        const inBetween = (intervals: Interval[][], i: number) => {
            for (const interval of intervals) {
                for (const { start, end } of interval) {
                    if (i >= start && i <= end) {
                        return { start, end };
                    }
                }
            }
        };
        const getNotEmptyArray = (a: Index[], b: Index[]) => a.length > 0 ? a : b;
        const findCurrentReplace = (found: Index[]) => {
            const result = new Map<number, Index>();
            for (const entry of found) {
                const existing = result.get(entry.i);
                if (!existing || entry.searchTerm.length >= existing.searchTerm.length) {
                    result.set(entry.i, entry);
                }
            }
            return [...result.values()].sort((a, b) => a.i - b.i)[0];
        };

        // Ignore if search is in i18n key: replace "id" in "{{id.key}}" with
        // "customer.id" and we need only the next one in string
        found.forEach(index => index.inBetween = inBetween(ignoredStrings, index.i));
        const foundToReplace = getNotEmptyArray(found.filter(index => !index.inBetween), found);
        const currentReplace = findCurrentReplace(foundToReplace);

        if (currentReplace.inBetween) {
            start = currentReplace.inBetween.end;
        } else {
            content = content.substring(0, currentReplace.i)
                + currentReplace.replacement
                + content.substring(currentReplace.i + currentReplace.searchTerm.length);
            start = currentReplace.i + currentReplace.replacement.length;
        }
    }
}


const findAllOccurrences = (string: string, substring: string, start: number): number[] => {
    if (!substring) {
        return [];
    }
    const indices: number[] = [];
    let index = start;
    while ((index = string.indexOf(substring, index)) !== -1) {
        indices.push(index);
        index += substring.length; // shift from current finding
    }
    return indices;
};

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

export function trimExtension(filePath: string) {
    return filePath.replace(/\.[^/.]+$/, "");
}

export function traverse(json: any, paths: string[], callback: (json: any, key: string | number, paths: string[]) => void) {
    if (!json) {
        return;
    }
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
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

export function getI18nPropertyKeys(files: ReadonlyMap<string, string>) {
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
