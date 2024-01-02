import * as convert from "xml-js";
import * as fs from "fs";

import AppVariantManager from "../../src/appVariantManager";
import { posix as path } from "path";

const normalizer = require("@ui5/project").normalizer;
const resourceFactory = require("@ui5/fs").resourceFactory;
const TaskUtil = require("@ui5/builder/lib/tasks/TaskUtil");
const BuildContext = require("@ui5/builder/lib/builder/BuildContext");

export default class TestUtil {

    static ENV = { env: { "CF_COLOR": "false" } };

    static getResource(filename: string): string {
        return fs.readFileSync(this.getResourcePath(filename), { encoding: "utf-8" });
    }

    static getResourceXml(filename: string): string {
        const expectedXml = TestUtil.getResource(filename);
        const convertXmlOptions = { compact: true, spaces: 4 };
        return convert.json2xml(convert.xml2json(expectedXml, convertXmlOptions), convertXmlOptions);
    }

    static getResourceJson(filename: string): string {
        return JSON.parse(TestUtil.getResource(filename));
    }

    static getResourceBuffer(filename: string): Buffer {
        return fs.readFileSync(this.getResourcePath(filename));
    }

    private static getResourcePath(filename: string): string {
        return path.join(process.cwd(), "test", "resources", filename);
    }

    static async getWorkspace(projectName: string, namespace: string) {
        const project = await normalizer.generateProjectTree({ cwd: path.join(process.cwd(), "test", "resources", projectName) });
        const rootPath = ["resources"];
        if (namespace) {
            rootPath.push(namespace);
        }
        const getVirtualBasePathPrefix = () => "/" + path.join(...rootPath);
        const resourceCollections = resourceFactory.createCollectionsForTree(project, { getVirtualBasePathPrefix });
        const workspace = resourceFactory.createWorkspace({
            virBasePath: "/",
            reader: resourceCollections.source,
            name: "projectName1"
        });
        const buildContext = new BuildContext({ rootProject: project });
        const taskUtil = new TaskUtil({
            projectBuildContext: buildContext.createProjectContext({
                project, // TODO 2.0: Add project facade object/instance here
                resources: {
                    workspace,
                    dependencies: resourceCollections.dependencies
                }
            })
        });
        return { workspace, taskUtil };
    }

    static async getAppVariantInfo(projectName: string, namespace: string) {
        const projectMeta = await TestUtil.getWorkspace(projectName, namespace);
        const appVariantResources = await AppVariantManager.getAppVariantResources(projectMeta.workspace);
        return AppVariantManager.getAppVariantInfo(appVariantResources);
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

    /**
     * 
     * @param resources Factory for filter predicate to filter not omited resources
     * @param taskUtil 
     * @returns Filter function
     */
    static byIsOmited(taskUtil: any) {
        return (resource: any) => !taskUtil.getTag(resource, taskUtil.STANDARD_TAGS.OmitFromBuildResult);
    }
}