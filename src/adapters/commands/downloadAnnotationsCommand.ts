import AnnotationManager from "../../annotationManager.js";
import { IConfiguration } from "../../model/configuration.js";
import { AdaptCommand } from "./command.js";
import Language from "../../model/language.js";

export default class DownloadAnnotationsCommand extends AdaptCommand {
    constructor(
        private appVariantId: string,
        private prefix: string,
        private annotationManager: AnnotationManager,
        private configuration: IConfiguration) {
        super();
    }

    accept = (filename: string) => filename === "manifest.json";

    async execute(files: Map<string, string>, filename: string): Promise<void> {
        const languages = Language.create(this.configuration.languages);
        const baseAppManifest = JSON.parse(files.get(filename)!);
        let newFiles = await this.annotationManager.process(baseAppManifest, languages, this.appVariantId, this.prefix);
        if (newFiles) {
            newFiles.forEach((value, key) => files.set(key, value));
        }
        files.set(filename, JSON.stringify(baseAppManifest));
    }
}   
