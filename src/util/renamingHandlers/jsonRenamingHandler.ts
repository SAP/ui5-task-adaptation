import { IRenamingHandler } from "./renamingHandler.js";

export default abstract class JsonRenamingHandler implements IRenamingHandler {

    private original: Map<string, any> = new Map<string, any>();
    protected abstract filePath: string;
    // path to the JSON properties, forward slash separated, e.g. "sap.ui5/appVariantIdHierarchy"
    protected abstract jsonPathsToRestore: string[];

    before(files: ReadonlyMap<string, string>): void {
        const content = files.get(this.filePath);
        if (content) {
            const json = JSON.parse(content);
            this.jsonPathsToRestore.forEach(path => this.store(json, path));
        }
    }

    after(files: Map<string, string>): void {
        const content = files.get(this.filePath);
        if (content) {
            const json = JSON.parse(content);
            this.restore(json);
            files.set(this.filePath, JSON.stringify(json));
        }
    }

    protected store(obj: any, path: string) {
        this.original.set(path, this.getByPath(obj, path.split("/")));
    }

    protected restore(obj: any) {
        this.original.forEach((value, path) => this.setByPath(obj, value, path.split("/")));
    }

    private getByPath(obj: any, path: string[]): any {
        return path.reduce((o, p) => (o && o[p]) || undefined, obj);
    }

    private setByPath(obj: any, value: any, path: string[]): void {
        const target = this.getByPath(obj, path.slice(0, -1));
        if (target) {
            target[path[path.length - 1]] = value;
        }
    }
}
