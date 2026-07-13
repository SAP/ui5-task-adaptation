export interface IRenamingHandler {
    before(files: ReadonlyMap<string, Buffer>): void;
    after(files: Map<string, Buffer>): void;
}
