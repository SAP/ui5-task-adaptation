declare module "@ui5/fs/lib" {
    export interface Resource {
        getPath(): string;
        setPath(path: string): void;
        getBuffer(): Promise<Buffer>;
    }
    export interface DuplexCollection {
        byGlob(virPattern: string, options?: IByGlobOptions): Promise<Resource[]>;
        write(resource: Resource): Promise<void>;
    }
    export interface IByGlobOptions {
        nodir: boolean;
    }
}

declare module "@ui5/fs/lib/resourceFactory" {
    import { Resource } from "@ui5/fs/lib";
    export function createResource({
        path,
        string
    }: IResourceParams): Resource;
    export interface IResourceParams {
        path: string;
        string: string;
    }
}

declare module "@ui5/builder/lib/tasks/TaskUtil" {
    import { Resource } from "@ui5/fs/lib";
    export default interface TaskUtil {
        STANDARD_TAGS: {
            OmitFromBuildResult: string;
        };
        setTag(resource: Resource, tag: string, value: boolean): void;
    }
}

declare module "@ui5/logger" {
    export default interface Logger {
        new(moduleName: string): Logger;
        isLevelEnabled(levelName: string): boolean;
        silly(...messages: string[]): void;
        verbose(...messages: string[]): void;
        info(...messages: string[]): void;
        warn(...messages: string[]): void;
        error(...messages: string[]): void;
        getLogger(moduleName: string): Logger;
    }
}
