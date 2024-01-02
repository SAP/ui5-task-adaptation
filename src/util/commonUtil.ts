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
        const [before, _] = replacement.split(search);
        // Matches a position in the string that is not immediately preceded by
        // the string "before". Since we won't replace anyway, we should also
        // ignore one with the slashes.
        const escapedBefore = escapeRegex(before).replaceAll("\\.", "[\\./]");
        escapedSearch = `(?<!${escapedBefore})${escapeRegex(search)}`;
    } else {
        escapedSearch = escapeRegex(search);
    }

    const dotToSlash = (update: string) => update.replaceAll(".", "\/");
    const replace = (content: string) => content.replace(new RegExp(escapedSearch, "g"), replacement);

    const replaceWithSlashesOnly = (content: string) => {
        if (!search.includes(".")) {
            return content;
        }
        let searchWithSlashes = dotToSlash(escapedSearch);
        return content.replace(new RegExp(searchWithSlashes, "g"), dotToSlash(replacement));
    }

    const renamed = new Map();
    files.forEach((content: string, filepath: string) => {
        // Finds the id with dots (test.id) or without dots (id) and replaces it
        content = replace(content);
        // Only if the id has dots, these dots will be replaced with slashes
        // first, and then it will search for the id with slashes and replace
        // with the appVariantId also with slashes
        content = replaceWithSlashesOnly(content);
        renamed.set(filepath, content);
    });
    return renamed;
}

export function removePropertiesExtension(filePath: string) {
    const lastIndexOf = filePath.lastIndexOf(".properties");
    return filePath.substring(0, lastIndexOf);
}