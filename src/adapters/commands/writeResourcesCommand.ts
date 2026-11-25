import ResourceUtil from "../../util/resourceUtil.js";
import { PostCommand } from "./command.js";

export default class WriteResourcesCommand extends PostCommand {
    constructor(private workspace: any, private projectNamespace: string) {
        super();
    }

    async execute(files: Map<string, Buffer>): Promise<void> {
        const writePromises = new Array<Promise<void>>();
        files.forEach((content, filename) => {
            const resource = ResourceUtil.createResource(filename, this.projectNamespace, content);
            writePromises.push(this.workspace.write(resource));
        });
        await Promise.all(writePromises);
    }
}
