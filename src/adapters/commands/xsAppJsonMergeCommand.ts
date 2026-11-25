import { merge } from "../../util/cf/xsAppJsonUtil.js";
import { MergeCommand } from "./command.js";
import { stringToBuffer, bufferToString } from "../../util/commonUtil.js";

export default class XsAppJsonMergeCommand extends MergeCommand {

    accept = (filename: string) => filename === "xs-app.json";

    async execute(files: Map<string, Buffer>, filename: string, appVariantContent: Buffer): Promise<void> {
        const baseContent = files.get(filename);
        const xsAppJsonFiles = [
            bufferToString(appVariantContent),
            baseContent ? bufferToString(baseContent) : undefined // base app xs-app.json comes last
        ].filter(file => file !== undefined) as string[];
        const result = merge(xsAppJsonFiles);
        if (result) {
            files.set(filename, stringToBuffer(result));
        }
    }

}
