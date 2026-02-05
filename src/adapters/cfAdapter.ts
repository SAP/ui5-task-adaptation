import { BaseAdapter, Mutator } from "./adapter.js";
import { merge, XSAPP_JSON_FILENAME } from "../util/cf/xsAppJsonUtil.js";

export default class CFAdapter extends BaseAdapter {
    protected mutators = [
        new XsAppJsonMerger()
    ];
}


class XsAppJsonMerger implements Mutator {
    async mutate(files: Map<string, string>, appVariantFiles: ReadonlyMap<string, string>): Promise<void> {
        const xsAppJsonFiles = [
            appVariantFiles.get(XSAPP_JSON_FILENAME),
            files.get(XSAPP_JSON_FILENAME) // base app xs-app.json comes last
        ].filter(file => file !== undefined) as string[];
        const result = merge(xsAppJsonFiles);
        if (result) {
            files.set(XSAPP_JSON_FILENAME, result);
        }
    }
}
