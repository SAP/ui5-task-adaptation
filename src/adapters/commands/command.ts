export abstract class AdaptCommand {
    readonly commandType = "adapt";
    abstract accept(filename: string): boolean;
    /**
     * Executes the command on the specified file
     * @param files - Map of all files being processed
     * @param filename - The current file being processed
     */
    abstract execute(files: Map<string, string>, filename: string): Promise<void>;
}


export class AdaptCommandChain {
    constructor(private files: ReadonlyMap<string, string>, private commands: AdaptCommand[]) { }

    /**
     * Executes all commands in the chain that accept the given filename
     * @param files - Map of all files being processed
     * @param filename - The current file being processed
     */
    async execute(): Promise<ReadonlyMap<string, string>> {
        const filesCopy = new Map(this.files);
        for (const [filename] of filesCopy) {
            for (const command of this.commands) {
                if (command.accept(filename)) {
                    await command.execute(filesCopy, filename);
                }
            }
        }
        return filesCopy;
    }
}


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


export abstract class ManifestUpdateCommand {
    readonly commandType = "manifestUpdate";
    /**
     * The command modifies the manifest in-place.
     * @param manifest base app manifest content as JSON object. 
     */
    abstract execute(manifest: any): Promise<void>;
}


export class ManifestUpdateCommandChain extends AdaptCommand {
    constructor(private commands: ManifestUpdateCommand[] = []) {
        super();
    }

    accept = (filename: string) => filename === "manifest.json";

    async execute(files: Map<string, string>, filename: string): Promise<void> {
        const manifestContent = files.get(filename);
        if (!manifestContent) {
            throw new Error("Original application should have manifest.json in root folder");
        }
        const manifest = JSON.parse(manifestContent);
        for (const command of this.commands) {
            await command.execute(manifest);
        }
        files.set(filename, JSON.stringify(manifest));
    }
}


export abstract class PostCommand {
    readonly commandType = "post";
    /**
     * Executes the command on the specified file
     * @param files - Map of all files being processed
     * @param filename - The current file being processed
     * @param appVariantContent - Content from the app variant
     */
    abstract execute(files: Map<string, string>): Promise<void>;
}


/**
 * CommandChain implements the Chain of Responsibility pattern
 * It manages a collection of commands and executes them in sequence
 */
export class PostCommandChain {
    protected commands: PostCommand[];

    constructor(commands: PostCommand[] = []) {
        this.commands = commands;
    }

    /**
     * Executes all commands in the chain that accept the given filename
     * @param files - Map of all files being processed
     */
    async execute(files: ReadonlyMap<string, string>): Promise<ReadonlyMap<string, string>> {
        const filesCopy = new Map(files);
        for (const command of this.commands) {
            await command.execute(filesCopy);
        }
        return filesCopy;
    }
}
