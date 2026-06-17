import ResourceUtil, { TEXT_EXTENSIONS } from "./resourceUtil.js";
import { posix as path } from "path";

const UTF8 = "utf8";

export default class WorkspaceManager {

    private snapshot: Map<string, Buffer> | undefined;

    constructor(private readonly workspace: IWorkspace, private readonly projectNamespace: string) { }


    async createSnapshot(): Promise<void> {
        const resources: any[] = await this.workspace.byGlob("/**/*");
        const rootFolderLength = ResourceUtil.getRootFolder(this.projectNamespace).length;
        const entries = await Promise.all(
            resources.map(async (resource) => {
                const filename = resource.getPath().substring(rootFolderLength + 1);
                return [filename, await resource.getBuffer()] as const;
            })
        );
        this.snapshot = new Map(entries);
    }


    async restoreSnapshot(): Promise<void> {
        if (!this.snapshot) {
            throw new Error("No snapshot to restore — call createSnapshot() first");
        }
        const writes: Promise<void>[] = [];
        this.snapshot.forEach((buffer, filename) => {
            const resource = ResourceUtil.createResource(filename, this.projectNamespace, buffer);
            writes.push(this.workspace.write(resource));
        });
        await Promise.all(writes);
    }


    async saveAndConvert(buffersPromise: Promise<ReadonlyMap<string, Buffer>>): Promise<ReadonlyMap<string, string>> {
        const buffers = await buffersPromise;
        const writes: Promise<void>[] = [];
        const text = new Map<string, string>();
        buffers.forEach((buffer, filename) => {
            if (TEXT_EXTENSIONS.has(path.extname(filename).slice(1))) {
                text.set(filename, buffer.toString(UTF8));
            }
            writes.push(this.workspace.write(ResourceUtil.createResource(filename, this.projectNamespace, buffer)));
        });
        await Promise.all(writes);
        return text;
    }
}
