declare module "@ui5/logger" {
    export function getLogger(name: string): any;
}

declare module "@ui5/fs/resourceFactory" {
    export function createResource(options: any): any;
    export function createReader(options: any): any;
    export function createAdapter(options: any): any;
    export function createWorkspace(options: any): any;
    export function createCollectionsForTree(project: any, options: any): any;
}

declare class Resource {
    getPath(): string;
    clone(): Resource;
    setPath(path: string): void;
    getString(): Promise<string>;
    setString(string: string): void;
}

declare module "@ui5/fs/Resource" {
    export function getPath(): string;
    export function clone(): Resource;
    export function setPath(path: string): void;
    export function getString(): Promise<string>;
    export function setString(string: string): void;
}

declare module "@ui5/project/graph" {
    export function graphFromPackageDependencies(options: any): any;
}

declare module "@ui5/project/build/helpers/BuildContext" {
    export default class BuildContext {
        constructor(projectGraph: any, options: any);
        createProjectContext(options: any): any;
    }
}

declare module "@ui5/project/build/helpers/TaskUtil" {
    export default class TaskUtil {
        constructor(options: any);
    }
}
