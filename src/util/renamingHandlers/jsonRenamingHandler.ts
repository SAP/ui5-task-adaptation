export default abstract class JsonRenamingHandler {

    private original: Map<string, any> = new Map<string, any>();
    protected abstract filePath: string;
    // path to the JSON properties, forward slash separated, e.g. "sap.ui5/appVariantIdHierarchy"
    protected abstract jsonPathsToRestore: string[];

    accept(filename: string): boolean {
        return filename.endsWith(this.filePath);
    }

    before(json: any): void {
        this.jsonPathsToRestore.forEach(path => this.store(json, path));
    }

    after(json: any): void {
        this.restore(json);
    }

    protected store(obj: any, path: string) {
        // Clone so the snapshot is decoupled from `obj`: when the same object is
        // mutated in-place (JSON renaming), the stored value stays untouched.
        const value = this.getByPath(obj, path.split("/"));
        this.original.set(path, value === undefined ? undefined : structuredClone(value));
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
