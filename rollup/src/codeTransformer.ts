export default class CodeTransformer {

    static transform(code: string) {
        code = this.replaceRequireAsync(code);
        return code
            .replace(/sap\.ui\.define/g, "define")
            .replace(/\, \/\* bExport\= \*\/ true\)/g, ")")
            .replace(/}, true\);$/g, "});");
    }


    static replaceRequireAsync(code: string) {
        const requireAsyncPattern = /requireAsync\("(?<url>[\/\w]*)"\)/mg;
        const matches = new Map<string, string>();
        let match: RegExpExecArray | null = null;
        while (match = requireAsyncPattern.exec(code)) {
            if (match?.groups?.url) {
                matches.set(match[0], match.groups.url);
            }
        }
        matches.forEach((url, requireAsync) => code = code.replace(requireAsync, `require(${url})`));
        return code;
    }

}
