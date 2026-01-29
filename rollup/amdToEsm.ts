import { parse } from "meriyah";
import { traverse } from "../src/util/commonUtil.js";

export default function convert(content: string) {
    return [
        extractEsmClass
    ].reduce((result, converter) => converter(result), content);
}

function extractEsmClass(content: string) {
    const result = parse(content, { ranges: true });
    let classCode: { start: number, end: number } | undefined;
    traverse(result, [], (json, key) => {
        if (key === "type" && json[key] === "ClassDeclaration") {
            if (classCode) {
                throw new Error("Only one class declaration per module is allowed");
            }
            classCode = json;
        }
    });
    return classCode && "export default " + content.substring(classCode.start, classCode.end) || content;
}
