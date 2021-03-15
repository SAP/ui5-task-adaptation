import * as fs from "fs";
import * as path from "path";
import { normalizer } from "@ui5/project";
import * as resourceFactory from "@ui5/fs/lib/resourceFactory";
import AppVariantManager from "../../src/appVariantManager";
const TaskUtil = require("@ui5/builder/lib/tasks/TaskUtil");
const BuildContext = require("@ui5/builder/lib/builder/BuildContext");

export default class TestUtil {
    static getResource(filename: string): string {
        return fs.readFileSync(path.join(process.cwd(), "test", "resources", filename), { encoding: "utf-8" });
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
}