import { getLogger } from "@ui5/logger";
const log = getLogger("@ui5/task-adaptation::RenamingUtil");

const dotToSlash = (string: string) => string.replaceAll(".", "/");
const escapeRegex = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");


export function rename(content: string, references: string[], replacement: string): string {
    return renameMap(content, new Map(references.map(ref => [ref, replacement])), [replacement]);
}


/**
 * A precompiled renamer: the regex, replacement lookup and ignore set are built
 * once and can be applied to many strings via `replace` without recompilation.
 */
export interface Renamer {
    replace(content: string): string;
}


/**
 * Builds a reusable {@link Renamer} from the given references and ignore list.
 * The expensive work (regex compilation, lookup construction) happens here once;
 * the returned `replace` is a cheap single pass over each input string. Prefer
 * this over calling {@link renameMap} repeatedly with the same references.
 *
 * Note: mutates `references` by dropping entries whose dot-count doesn't match.
 */
export function compileRenamer(references: Map<string, string>, ignoreInStrings: string[]): Renamer {
    const ignoredReferenceKeys: string[] = [];
    for (const [key, value] of references) {
        if (value.includes(".") !== key.includes(".")) {
            log.info(`Ignoring renaming of "${key}" → "${value}" because the dot count does not match.`);
            ignoredReferenceKeys.push(key);
            references.delete(key);
        }
    }
    if (ignoredReferenceKeys.length > 0) {
        log.info(`Ignored renaming: ${ignoredReferenceKeys.join(", ")}`);
    }

    const searchTerms = [...references.keys()].filter(key => key.length > 0);
    if (searchTerms.length === 0) {
        return {
            replace: (content: string) => content
        };
    }

    // Build replacement lookup: pattern → replacement string (both dot and slash variants).
    const replacementMap = new Map<string, string>();
    for (const term of searchTerms) {
        const replacement = references.get(term)!;
        replacementMap.set(term, replacement);
        const slashTerm = dotToSlash(term);
        if (slashTerm !== term) {
            replacementMap.set(slashTerm, dotToSlash(replacement));
        }
    }

    // Build deduplicated ignore set with slash variants
    const ignoreSet = new Set<string>();
    for (const ignoredString of ignoreInStrings) {
        if (ignoredString) {
            ignoreSet.add(ignoredString);
            ignoreSet.add(dotToSlash(ignoredString));
        }
    }

    // When a string appears in both replacementMap and ignoreSet, ignoreSet
    // takes precedence — the match is skipped rather than replaced. Remove such
    // keys from replacementMap so the intent is explicit instead of relying on
    // runtime check order.
    for (const ignored of ignoreSet) {
        replacementMap.delete(ignored);
    }

    // Collect all unique patterns sorted by length descending (longest match first).
    // V8 compiles alternation of literal strings into an Aho-Corasick automaton
    // internally, giving us O(n + P + z) single-pass matching in native C++ code.
    const allPatterns = new Set<string>([...replacementMap.keys(), ...ignoreSet]);
    const sorted = [...allPatterns].sort((a, b) => b.length - a.length);
    // Reused across `replace` calls; `lastIndex` is reset at the start of each run.
    const regex = new RegExp(sorted.map(escapeRegex).join("|"), "g");

    return {
        replace(content: string): string {
            if (!content) {
                return content;
            }
            regex.lastIndex = 0;
            // Single-pass: find all matches, skip ignored ones, batch-replace the rest
            const parts: string[] = [];
            let lastEnd = 0;
            let match;
            while ((match = regex.exec(content)) !== null) {
                const matched = match[0];
                if (ignoreSet.has(matched)) {
                    // ignore takes priority over replacement
                    continue;
                }
                const replacement = replacementMap.get(matched);
                if (replacement !== undefined) {
                    parts.push(content.substring(lastEnd, match.index));
                    parts.push(replacement);
                    lastEnd = match.index + matched.length;
                }
            }
            // Nothing matched: return the original string without allocating a join.
            if (lastEnd === 0) {
                return content;
            }
            parts.push(content.substring(lastEnd));
            return parts.join("");
        }
    };
}


export function renameMap(content: string, references: Map<string, string>, ignoreInStrings: string[]): string {
    return compileRenamer(references, ignoreInStrings).replace(content);
}


export function renameJson(json: Record<string, unknown>, references: Map<string, string>, ignoreInStrings: string[]): void {
    const renamer = compileRenamer(references, ignoreInStrings);

    type Indexable = Record<string | number, unknown>;

    function processObject(obj: Record<string, unknown>): void {
        for (const key of Object.keys(obj)) {
            const renamedKey = renamer.replace(key);
            const value = obj[key];
            if (renamedKey !== key) {
                obj[renamedKey] = value;
                delete obj[key];
            }
            processValue(obj, renamedKey);
        }
    }

    function processValue(container: Record<string, unknown> | unknown[], index: string | number): void {
        const target = container as Indexable;
        const value = target[index];
        if (typeof value === "string") {
            target[index] = renamer.replace(value);
        } else if (Array.isArray(value)) {
            value.forEach((_, i) => processValue(value, i));
        } else if (value !== null && typeof value === "object") {
            processObject(value as Record<string, unknown>);
        }
    }

    processObject(json);
}


export function renameResources(files: ReadonlyMap<string, string>, search: string[], replacement: string): Map<string, string> {
    return new Map([...files].map(([filepath, content]) => [filepath, rename(content, search, replacement)]));
}
