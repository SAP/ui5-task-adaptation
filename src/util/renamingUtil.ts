import { getLogger } from "@ui5/logger";
const log = getLogger("@ui5/task-adaptation::RenamingUtil");


export function rename(content: string, references: string[], replacement: string): string {
    return renameMap(content, new Map(references.map(ref => [ref, replacement])), [replacement]);
}


export function renameMap(content: string, references: Map<string, string>, ignoreInStrings: string[]): string {
    const ignoredReferenceKeys: string[] = [];
    for (const [key, value] of references) {
        if (value.includes(".") !== key.includes(".")) {
            ignoredReferenceKeys.push(key);
            references.delete(key);
        }
    }
    if (ignoredReferenceKeys.length > 0) {
        log.info(`Ignored renaming: ${ignoredReferenceKeys.join(", ")}`);
    }

    const searchTerms = [...references.keys()].filter(key => key.length > 0);
    if (!content || !searchTerms || searchTerms.length === 0) {
        return content;
    }

    const dotToSlash = (str: string) => str.replaceAll(".", "/");
    const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // Build replacement lookup: pattern → replacement string (both dot and slash variants).
    // Empty keys are skipped to avoid infinite zero-width regex matches.
    const replacementMap = new Map<string, string>();
    for (const term of searchTerms) {
        if (!term) {
            continue;
        }
        const repl = references.get(term)!;
        replacementMap.set(term, repl);
        const slashTerm = dotToSlash(term);
        if (slashTerm !== term) {
            replacementMap.set(slashTerm, dotToSlash(repl));
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
    const regex = new RegExp(sorted.map(escapeRegex).join("|"), "g");

    // Single-pass: find all matches, skip ignored ones, batch-replace the rest
    const parts: string[] = [];
    let lastEnd = 0;
    let m;
    while ((m = regex.exec(content)) !== null) {
        const matched = m[0];
        if (ignoreSet.has(matched)) continue;
        const replacement = replacementMap.get(matched);
        if (replacement !== undefined) {
            parts.push(content.substring(lastEnd, m.index));
            parts.push(replacement);
            lastEnd = m.index + matched.length;
        }
    }
    parts.push(content.substring(lastEnd));
    return parts.join("");
}


export function renameResources(files: ReadonlyMap<string, string>, search: string[], replacement: string): Map<string, string> {
    return new Map([...files].map(([filepath, content]) => [filepath, rename(content, search, replacement)]));
}
