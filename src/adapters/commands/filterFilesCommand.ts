import { PostCommand } from "./command.js";
import { bufferToString } from "../../util/commonUtil.js";


export default class FilterFilesCommand extends PostCommand {
    async execute(files: Map<string, Buffer>): Promise<void> {
        const IGNORE_FILES = ["manifest.appdescr_variant"];
        const shouldIgnore = (filename: string, content: Buffer): boolean => {
            if (filename.endsWith(".change")) {
                return JSON.parse(bufferToString(content)).changeType?.startsWith("appdescr_"); // validate JSON
            }
            return IGNORE_FILES.includes(filename);
        }
        const toDelete: string[] = [];
        for (const [filename, content] of files) {
            if (shouldIgnore(filename, content)) {
                toDelete.push(filename);
            }
        }
        for (const filename of toDelete) {
            files.delete(filename);
        }
    }
}
