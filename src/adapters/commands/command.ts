export abstract class MergeCommand {
    readonly commandType = "merge";
    abstract accept(filename: string): boolean;
    /**
     * Executes the command on the specified file
     * @param files - Map of all files being processed
     * @param filename - The current file being processed
     * @param appVariantContent - Content from the app variant
     */
    abstract execute(files: Map<string, string>, filename: string, appVariantContent: string): Promise<void>;
}


/**
 * CommandChain implements the Chain of Responsibility pattern
 * It manages a collection of commands and executes them in sequence
 */
export class MergeCommandChain {
    constructor(private commands: MergeCommand[] = []) { }

    /**
     * Executes all commands in the chain that accept the given filename
     * @param files - Map of all files being processed
     * @param filename - The current file being processed
     * @param appVariantContent - Content from the app variant
     */
    async execute(files: ReadonlyMap<string, string>, appVariantFiles: ReadonlyMap<string, string>): Promise<ReadonlyMap<string, string>> {
        const filesCopy = new Map(files);
        for (const [filename, appVariantContent] of appVariantFiles) {
            const acceptedCommands = this.commands.filter(command => command.accept(filename));
            if (acceptedCommands.length > 0) {
                for (const command of acceptedCommands) {
                    await command.execute(filesCopy, filename, appVariantContent);
                }
            } else {
                filesCopy.set(filename, appVariantContent);
            }
        }
        return filesCopy;
    }
}
