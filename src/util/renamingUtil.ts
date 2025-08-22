import { getLogger } from "@ui5/logger";
const log = getLogger("@ui5/task-adaptation::RenamingUtil");


export function rename(content: string, references: string[], replacement: string): string {
    return renameMap(content, new Map(references.map(ref => [ref, replacement])), [replacement]);
}


export function renameMap(content: string, references: Map<string, string>, ignoreInStrings: string[]): string {
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

    const searchTerms = [...references.keys()];
    if (!content || !searchTerms || searchTerms.length === 0) {
        return content;
    }

    const dotToSlash = (str: string) => str.replaceAll(".", "\/");
    // We don't want to replace in adaptation project ids
    ignoreInStrings.push(...ignoreInStrings, ...ignoreInStrings.map(dotToSlash));

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
                replacement: references.get(searchTerm)!,
                searchTerm
            }, {
                i: content.indexOf(searchTermSlash, start),
                replacement: dotToSlash(references.get(searchTerm)!),
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
        // If we found two strings with the same index, we take the longest one
        // to replace, e.g.: app.variant and app.variant2 has the same index,
        // but we don't want to replace the first one with customer.app.variant,
        // otherwise we get customer.app.variant2, which we don't need. We need
        // to replace the whole app.variant2 with customer.app.variant. 
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
        // There might be a situation when we found something in ignored
        // substrings and the index could be the nearest, but after that the
        // next index might be the actual find to replace, so we first of all
        // ignore all the ignored substring findings and get the next actual
        // replacement. But if there are only ignored substrings found, we take
        // the first one just to skip it and go further.
        const currentReplace = findCurrentReplace(found);

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


export function renameResources(files: ReadonlyMap<string, string>, search: string[], replacement: string): Map<string, string> {
    return new Map([...files].map(([filepath, content]) => [filepath, rename(content, search, replacement)]));
}


function findAllOccurrences(string: string, substring: string, start: number): number[] {
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
