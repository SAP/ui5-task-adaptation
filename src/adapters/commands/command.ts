import { stringToBuffer, bufferToJson } from "../../util/commonUtil.js";
import { getLogger } from "@ui5/logger";
const log = getLogger("@ui5/task-adaptation::CommandChain");


export abstract class SetupCommand {
    readonly commandType = "setup";
    /**
     * Executes the command
     */
    abstract execute(): Promise<void>;
}


export class SetupCommandChain {
    constructor(private commands: SetupCommand[]) { }

    /**
     * Executes all commands in the chain
     */
    async execute(): Promise<void> {
        const timings: Timing[] = [];
        for (const command of this.commands) {
            const start = performance.now();
            await command.execute();
            pushTiming(command, timings, start);
        }
        logTimings(this, timings);
    }
}


export abstract class AdaptCommand {
    readonly commandType = "adapt";
    abstract accept(filename: string): boolean;
    /**
     * Executes the command on the specified file
     * @param files - Map of all files being processed
     * @param filename - The current file being processed
     */
    abstract execute(files: Map<string, Buffer>, filename: string): Promise<void>;
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
    abstract execute(files: Map<string, Buffer>, filename: string, appVariantContent: Buffer): Promise<void>;
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

    async execute(files: Map<string, Buffer>, filename: string): Promise<void> {
        const manifestContent = files.get(filename);
        if (!manifestContent) {
            throw new Error("Original application should have manifest.json in root folder");
        }
        const manifest = bufferToJson(manifestContent);
        const timings: Timing[] = [];
        for (const command of this.commands) {
            const start = performance.now();
            await command.execute(manifest);
            pushTiming(command, timings, start);
        }
        files.set(filename, stringToBuffer(JSON.stringify(manifest)));
        logTimings(this, timings);
    }
}


export abstract class PostCommand {
    readonly commandType = "post";
    /**
     * Executes the command on the specified file
     * @param files - Map of all files being processed
     */
    abstract execute(files: Map<string, Buffer>): Promise<void>;
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
    async execute(files: ReadonlyMap<string, Buffer>): Promise<ReadonlyMap<string, Buffer>> {
        const filesCopy = new Map(files);
        const timings: Timing[] = [];
        for (const command of this.commands) {
            const start = performance.now();
            await command.execute(filesCopy);
            pushTiming(command, timings, start);
        }
        logTimings(this, timings);
        return filesCopy;
    }
}


export class AdaptCommandChain {
    private adaptCommands: AdaptCommand[];
    private mergeCommands: MergeCommand[];

    constructor(
        private files: ReadonlyMap<string, Buffer>,
        private appVariantFiles: ReadonlyMap<string, Buffer>,
        commands: (AdaptCommand | MergeCommand)[]
    ) {
        this.adaptCommands = commands.filter((c): c is AdaptCommand => c.commandType === "adapt");
        this.mergeCommands = commands.filter((c): c is MergeCommand => c.commandType === "merge");
    }

    async execute(): Promise<ReadonlyMap<string, Buffer>> {
        const filesCopy = new Map(this.files);
        const timings: Timing[] = [];
        for (const command of this.adaptCommands) {
            const start = performance.now();
            for (const [filename] of filesCopy) {
                if (command.accept(filename)) {
                    await command.execute(filesCopy, filename);
                }
            }
            pushTiming(command, timings, start);
        }
        for (const command of this.mergeCommands) {
            const start = performance.now();
            for (const [filename, appVariantContent] of this.appVariantFiles) {
                if (command.accept(filename)) {
                    await command.execute(filesCopy, filename, appVariantContent);
                }
            }
            pushTiming(command, timings, start);
        }
        for (const [filename, appVariantContent] of this.appVariantFiles) {
            const accepted = this.mergeCommands.some(command => command.accept(filename));
            if (!accepted) {
                filesCopy.set(filename, appVariantContent);
            }
        }
        logTimings(this, timings);
        return filesCopy;
    }
}


export interface IPromiseCommand<T> {
    result: Promise<T>;
}

type Timing = { name: string; duration: number };

function logTimings(chain: { constructor: { name: string } }, timings: Timing[]): void {
    log.info(`${chain.constructor.name}:`);
    timings.forEach(({ name, duration }) => log.info(`  ${name}: ${duration.toFixed(2)}ms`));
}

function pushTiming(command: { constructor: { name: string } }, timings: Timing[], start: number): void {
    timings.push({ name: command.constructor.name, duration: performance.now() - start });
}
