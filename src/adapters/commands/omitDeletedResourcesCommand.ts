import TaskUtil from "@ui5/project/build/helpers/TaskUtil";
import ResourceUtil from "../../util/resourceUtil.js";
import { PostCommand } from "./command.js";

export default class OmitDeletedResourcesCommand extends PostCommand {

    constructor(
        private taskUtil: TaskUtil,
        private movedFiles: Map<string, string>,
        private resources: ReadonlyArray<Resource> = [],
        private projectNamespace: string
    ) {
        super();
    }

    async execute(files: Map<string, Buffer>): Promise<void> {
        for (const resource of this.resources) {
            const relativePath = ResourceUtil.relativeToRoot(resource.getPath(), this.projectNamespace);
            if (!files.has(relativePath)) {
                this.taskUtil.setTag(resource, this.taskUtil.STANDARD_TAGS.OmitFromBuildResult, true);
                const newPath = this.movedFiles.get(relativePath);
                if (newPath) {
                    const renamedContent = files.get(newPath);
                    if (renamedContent) {
                        resource.setBuffer(renamedContent);
                    }
                }
            }
        }
    }
}
