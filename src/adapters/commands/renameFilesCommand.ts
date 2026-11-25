import FileRenamer from "../../util/renaming/fileRenamer.js";
import { PostCommand } from "./command.js";


export default class RenameFilesCommand extends PostCommand {
    constructor(private references: Map<string, string>) {
        super();
    }

    async execute(files: Map<string, Buffer>): Promise<void> {
        FileRenamer.rename(files, this.references);
    }
}
