import { PostCommand } from "./command.js";
import IAnnotationManager from "../../annotations/annotationManager.js";
import { stringToBuffer, bufferToJson } from "../../util/commonUtil.js";

export default class DownloadAnnotationsCommand extends PostCommand {
    constructor(
        private appVariantId: string,
        private prefix: string,
        private annotationManager: IAnnotationManager,
    ) {
        super();
    }

    async execute(files: Map<string, Buffer>): Promise<void> {
        const filename = "manifest.json";
        const baseAppManifest = bufferToJson(files.get(filename)!);
        let newFiles = await this.annotationManager.process(baseAppManifest, this.appVariantId, this.prefix);
        if (newFiles) {
            newFiles.forEach((value, key) => files.set(key, stringToBuffer(value)));
        }
        files.set(filename, stringToBuffer(JSON.stringify(baseAppManifest)));
    }
}
