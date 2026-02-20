import { merge } from "../../util/cf/xsAppJsonUtil.js";
import { MergeCommand } from "./command.js";

export default class XsAppJsonMergeCommand extends MergeCommand {

    accept = (filename: string) => filename === "xs-app.json";

    async execute(files: Map<string, string>, filename: string, appVariantContent: string): Promise<void> {
        const baseContent = files.get(filename);
        const xsAppJsonFiles = [
            appVariantContent,
            baseContent // base app xs-app.json comes last
        ].filter(file => file !== undefined) as string[];
        const result = merge(xsAppJsonFiles);
        if (result) {
            files.set(filename, result);
        }
    }

}
