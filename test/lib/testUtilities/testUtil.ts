import * as convert from "xml-js";
import * as fs from "fs";
import * as util from "util";

import AppVariant from "../../../src/appVariantManager.js";
import Language from "../../../src/model/language.js";
import ResourceUtil from "../../../src/util/resourceUtil.js";
import { glob } from "glob";
import { minimatch } from "minimatch";
import { posix as path } from "path";

export default class TestUtil {

    static ENV = { env: { "CF_COLOR": "false" } };

    static getResource(filename: string): string {
        return fs.readFileSync(this.getResourcePath(filename), { encoding: "utf-8" });
    }

    static getResourceXml(filename: string): string {
        const xml = TestUtil.getResource(filename);
        return TestUtil.normalizeXml(xml);
    }

    static normalizeXml(xml: string): string {
        const convertXmlOptions = { compact: true, spaces: 4 };
        return convert.json2xml(convert.xml2json(xml, convertXmlOptions), convertXmlOptions);
    }

    static getResourceJson(filename: string): any {
        return JSON.parse(TestUtil.getResource(filename));
    }

    static getResourceBuffer(filename: string): Buffer {
        return fs.readFileSync(this.getResourcePath(filename));
    }

    static getResourcePath(...filename: string[]): string {
        return path.join(...[process.cwd(), "test", "resources", ...filename]);
    }

    static async getWorkspace(projectName: string, namespace: string) {
        // TODO: switch to this if BuilContext made public again
        // const cwd = path.join(process.cwd(), "test", "resources", projectName);
        // const projectGraph = await graphFromPackageDependencies({ cwd });
        // const project = projectGraph.getProject(projectName);
        // const workspace = resourceFactory.createWorkspace({
        //     reader: createReader({
        //         fsBasePath: cwd,
        //         virBasePath: `/resources/${namespace}/`,
        //         name: `Source reader for application project ${projectName}`,
        //         project
        //     })
        // });
        // const buildContext = new BuildContext(projectGraph, {});
        // const taskUtil = new TaskUtil({
        //     projectBuildContext: buildContext.createProjectContext({ project })
        // });
        // return { workspace, taskUtil };
        const folder = path.join(process.cwd(), "test", "resources", projectName);
        return { workspace: new Workspace(folder, namespace), taskUtil: new TaskUtil() };
    }

    static async getAppVariant(projectName: string, namespace: string) {
        const projectMeta = await TestUtil.getWorkspace(projectName, namespace);
        return AppVariant.fromWorkspace(projectMeta.workspace, namespace);
    }



    static getStdOut(stdout: any, exitCode: number = 0, stderr: string = "") {
        return Promise.resolve({
            stdout: typeof stdout === "string" ? stdout : JSON.stringify(stdout),
            stderr,
            exitCode
        });
    }


    static getResourceByName(resources: any[], name: string): Promise<string> {
        const file = resources.find(res => res.getPath().endsWith(name));
        if (file) {
            return file.getBuffer().then((buffer: any) => buffer.toString());
        }
        throw new Error(`Resources have no ${name}`);
    }


    static getResourceJsonByName(resources: any[], name: string): Promise<any> {
        return this.getResourceByName(resources, name).then((string) => JSON.parse(string));
    }

    static write(path: string, data: any): void {
        fs.writeFileSync(path, data);
    }

    static inspect(json: any): void {
        console.log(util.inspect(json, true, Number.MAX_SAFE_INTEGER, true));
    }

    /**
     *
     * @param resources Factory for filter predicate to filter not omited resources
     * @param taskUtil
     * @returns Filter function
     */
    static byIsOmited(taskUtil: any) {
        return (resource: any) => !taskUtil.getTag(resource, taskUtil.STANDARD_TAGS.OmitFromBuildResult);
    }

    static filter(array: string[], search?: string): string[] {
        return search ? array.filter(item => item === search) : array;
    }

    static getMapValueBySAPLanguageCode<V>(map: Map<Language, V>, language: Language): V | undefined {
        const hit = Array.from(map.entries()).find(([key]) => key.sap === language.sap);
        return hit ? hit[1] : undefined;
    }

    static async wait(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    static shuffleArray(array: any[]): any[] {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    static permuteArray<T>(nums: T[]): T[][] {
        const results: T[][] = [];
        nums.sort(); // sorting to remove duplicates
        const used: boolean[] = new Array(nums.length).fill(false);

        function backtrack(path: T[]) {
            if (path.length === nums.length) {
                results.push([...path]);
                return;
            }

            for (let i = 0; i < nums.length; i++) {
                if (used[i]) {
                    continue;
                }
                // skip duplicates
                if (i > 0 && nums[i] === nums[i - 1] && !used[i - 1]) {
                    continue;
                }
                used[i] = true;
                path.push(nums[i]);
                backtrack(path);
                path.pop();
                used[i] = false;
            }
        }

        backtrack([]);
        return results;
    }
}

class Workspace implements IWorkspace {
    private folder: string;
    private namespace: string;
    private resources = new Map<string, any>();
    constructor(folder: string, namespace: string) {
        this.folder = folder;
        this.namespace = namespace;
    }
    async byGlob(pattern: string) {
        if (this.resources.size === 0) {
            const webappFolder = path.join(this.folder, "webapp");
            const files = await glob(webappFolder + "/**/*.*");
            for (const file of files) {
                if (fs.statSync(file).isFile()) {
                    const relativePath = path.relative(webappFolder, file);
                    const content = fs.readFileSync(file, { encoding: "utf-8" });
                    const resource = ResourceUtil.createResource(relativePath, this.namespace, content);
                    this.resources.set(resource.getPath(), resource);
                }
            }
        }
        const rotFolder = ResourceUtil.getRootFolder(this.namespace);
        const result = new Array<any>();
        for (const resource of [...this.resources.values()]) {
            if (minimatch(resource.getPath(), rotFolder + pattern)) {
                const relativePath = ResourceUtil.relativeToRoot(resource.getPath(), this.namespace);
                result.push(ResourceUtil.createResource(relativePath, this.namespace, await resource.getString()));
            }
        }
        return result;
    }
    async write(resource: any): Promise<void> {
        this.resources.set(resource.getPath(), resource);
    }
}

class TaskUtil {
    STANDARD_TAGS = {
        OmitFromBuildResult: "OmitFromBuildResult"
    };
    private resources = new Map<string, boolean>();
    setTag(resource: any, _: any, value: boolean) {
        this.resources.set(resource.getPath(), value);
    }
    getTag(resource: any): boolean | undefined {
        return this.resources.get(resource.getPath());
    }
}

export function metadataV4Xml(references: string, annotations = "", schema = '<Schema Namespace="com.sap.self" Alias="SAP__self">') {
    return `<?xml version="1.0" encoding="utf-8"?>
<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx" xmlns="http://docs.oasis-open.org/odata/ns/edm">
    ${references}
    <edmx:DataServices>
        ${schema}
            ${annotations}
        </Schema>
    </edmx:DataServices>
</edmx:Edmx>`;
}
