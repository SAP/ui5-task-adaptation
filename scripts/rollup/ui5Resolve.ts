import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

//@ts-ignore
import convertAMDtoES6 from "@buxlabs/amd-to-es6";
import convertAMDtoESM from "./amdToEsm.js";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { getLogger } from "@ui5/logger";

const log = getLogger("rollup-plugin-ui5-resolve-task-adaptation");
const __dirname = dirname(fileURLToPath(import.meta.url));


interface TransformCase {
    accept(code: string, id: string): string;
}

class UriTransformCase implements TransformCase {
    accept(code: string, id: string) {
        if (id !== "sap/ui/thirdparty/URI") {
            return code;
        }
        const header = code.substring(0, code.indexOf("(function"));
        const neededCode = code.substring(code.indexOf("root) {") + 8, code.lastIndexOf("}));"))
            .replace(/root/g, "window");
        return header + "define('sap/ui/thirdparty/URI', [], function () {" + neededCode + "});";
    }
}


export default function (options: any) {

    const skipTransformation = (id: string) => !options.skipTransformation?.includes(id);

    return {

        name: "ui5-resolve",

        /*
         * Right before writing result to dist
         */
        renderChunk: (code: string) => {
            return `var window = {};\n${code}`;
        },


        resolveId: (source: string, importer: string) => {
            log.verbose(`resolveId: ${source} from ${importer}`);
            if (importer && source.startsWith(".")) {
                source = path.posix.join(path.dirname(importer), source);
            }
            log.verbose(" --> resolve to: " + source);
            return source;
        },


        load: async (id: string) => {
            log.verbose(`load: ${id}`);

            const localFile = path.join(__dirname, id);
            if (fs.existsSync(localFile)) {
                log.info(`Bundle definition "${id}"`);
                return fs.readFileSync(localFile, {
                    encoding: "utf8"
                });
            }

            const localOverride = path.resolve(__dirname, "overrides", id + ".js");
            if (fs.existsSync(localOverride)) {
                log.info(`Override with "${id}"`);
                return fs.readFileSync(localOverride, { encoding: "utf8" });
            }
            const filepath = `/resources/${id}.js`;
            if (options.resources.has(filepath)) {
                return await options.resources.get(filepath).getString();
            }
        },


        transform: (code: string, id: string): string | undefined => {
            const skipped = !skipTransformation(id);
            log.verbose(`transform: ${id} ${skipped ? "skipped" : ""}`);
            if (skipped) {
                return;
            }

            code = replaceRequireAsync(code);
            code = transform(code, id);

            code = code
                .replace(/sap\.ui\.define/g, "define")
                .replace(/\, \/\* bExport\= \*\/ true\)/g, ")")
                .replace(/},.*(true|false)\);$/g, "});")
                .replace(/},.*(true|false)\);(\n\/\/# sourceMappingURL=)*/g, "});\n//# sourceMappingURL=");
            try {
                return convertAMDtoES6(code);
            } catch (_: any) {
                return convertAMDtoESM(code);
            }
        }

    };
};


function transform(code: string, id: string) {
    const transformers = [
        new UriTransformCase()
    ];
    for (const transformer of transformers) {
        code = transformer.accept(code, id);
    }
    return code;
}


function replaceRequireAsync(code: string) {
    const requireAsyncPattern = /requireAsync((.bind\(this, ")|(\("))+(?<url>[\/\w]*)"\)/mg;
    let match, defineUrls = new Array<string>(), defineVars = new Array<string>(), matches = new Map();
    while (match = requireAsyncPattern.exec(code)) {
        if (match.groups?.url) {
            const varaibleName = match.groups.url.split("/").pop() + crypto.randomBytes(16).toString("hex");
            defineUrls.push(`"${match.groups.url}"`);
            defineVars.push(varaibleName);
            const value = match[0].includes("requireAsync.bind")
                ? `() => Promise.resolve(${varaibleName})`
                : varaibleName;
            matches.set(match[0], value);
        }
    }
    if (defineUrls.length > 0 && defineVars.length > 0) {
        matches.forEach((value, key) => code = code.replace(key, value));
        code = replaceRequireAsyncWith(code, `"sap/ui/fl/requireAsync"`, defineUrls);
        code = replaceRequireAsyncWith(code, "requireAsync", defineVars);
    }
    return code;
}


function replaceRequireAsyncWith(code: string, requireAsyncSearchKeyword: string, inserts: string[]) {
    return code.replace(requireAsyncSearchKeyword, inserts.join(",\n\t"));
}
