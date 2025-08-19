export interface IRenamingHandler {
    before(files: ReadonlyMap<string, string>): void;
    after(files: Map<string, string>): void;
}
