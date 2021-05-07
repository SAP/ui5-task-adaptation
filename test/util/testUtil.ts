import * as fs from "fs";
import * as path from "path";

import AppVariantManager from "../../src/appVariantManager";

const normalizer = require("@ui5/project").normalizer;
const resourceFactory = require("@ui5/fs").resourceFactory;
const TaskUtil = require("@ui5/builder/lib/tasks/TaskUtil");
const BuildContext = require("@ui5/builder/lib/builder/BuildContext");

export default class TestUtil {

    static ENV = { env: { "CF_COLOR": "false" } };

    static getResource(filename: string): string {
        return fs.readFileSync(this.getResourcePath(filename), { encoding: "utf-8" });
    }

    static getResourceBuffer(filename: string): Buffer {
        return fs.readFileSync(this.getResourcePath(filename));
    }

    private static getResourcePath(filename: string): string {
        return path.join(process.cwd(), "test", "resources", filename);
    }

    static async getWorkspace(projectName: string) {
        const project = await normalizer.generateProjectTree({ cwd: path.join(process.cwd(), "test", "resources", projectName) });
        const resourceCollections = resourceFactory.createCollectionsForTree(project, {});
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

    static async getAppVariantInfo(projectName: string) {
        const projectMeta = await TestUtil.getWorkspace(projectName);
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


    static getResourceByName(resources: any[], name: string): Promise<Buffer> {
        return resources.find(res => res.getPath().endsWith(name)).getBuffer();
    }
}