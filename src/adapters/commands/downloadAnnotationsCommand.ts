import { AdaptCommand } from "./command.js";
import IAnnotationManager from "../../annotations/annotationManager.js";

export default class DownloadAnnotationsCommand extends AdaptCommand {
    constructor(
        private appVariantId: string,
        private prefix: string,
        private annotationManager: IAnnotationManager,
    ) {
        super();
    }

    accept = (filename: string) => filename === "manifest.json";

    async execute(files: Map<string, string>, filename: string): Promise<void> {
        const baseAppManifest = JSON.parse(files.get(filename)!);
        let newFiles = await this.annotationManager.process(baseAppManifest, this.appVariantId, this.prefix);
        if (newFiles) {
            newFiles.forEach((value, key) => files.set(key, value));
        }
        files.set(filename, JSON.stringify(baseAppManifest));
    }
}   
