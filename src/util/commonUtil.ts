export function replaceDots(value: string) {
    return value.replace(/\./g, "_");
}


export function validateObject<T extends Object>(options: T, properties: Array<keyof T>, message: string) {
    for (const property of properties) {
        if (!options[property]) {
            throw new Error(`'${String(property)}' ${message}`);
        }
    }
}


export function renameResources(files: Map<string, string>, search: string, replacement: string): Map<string, string> {
	const escapeRegexSpecialChars = (update: string) => update.replaceAll(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
    // The current regex works if the old Id is contained in the new Id, given
    // that they do not have the same beginning.
    // more complete alternative: /((?<!newIdStart)|(?!newIdEnd))oldId/g
    if (replacement.includes(search)) {
		const [before, _] = replacement.split(search);
		// Matches a position in the string that is not immediately preceded by
		// the string "before".
        search = `(?<!${escapeRegexSpecialChars(before)})${escapeRegexSpecialChars(search)}`;
    } else {
		search = escapeRegexSpecialChars(search);
	}

	const dotToSlash = (update: string) => update.replaceAll(".", "\/");
    const replaces = [
        {
            regexp: new RegExp(search, "g"),
            replacement
        },
        {
            regexp: new RegExp(dotToSlash(search), "g"),
            replacement: dotToSlash(replacement)
        }
    ];
    const renamed = new Map();
    files.forEach((content: string, filepath: string) => {
        renamed.set(filepath, replaces.reduce((p, c) => p.replace(c.regexp, c.replacement), content));
    });
    return renamed;
}