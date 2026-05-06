import { PostCommand } from "./command.js";


export default class FilterFilesCommand extends PostCommand {
    async execute(files: Map<string, string>): Promise<void> {
        const IGNORE_FILES = ["manifest.appdescr_variant"];
        const shouldIgnore = (filename: string, content: string): boolean => {
            if (filename.endsWith(".change")) {
                return JSON.parse(content).changeType?.startsWith("appdescr_"); // validate JSON
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
