import * as fs from "fs";
import * as path from "path";
import * as semver from "semver";
import * as yaml from "js-yaml";
import Bundler from "./bundler";

const { normalizer } = require("@ui5/project");
const log = require("@ui5/logger").getLogger("rollup-plugin-ui5-resolve-task-adaptation");

const projectPaths = [
    path.resolve(__dirname, "rollup", "project")
];
const LATEST_VERSION_PLACEHOLDER = "0.0.0";

export default class Builder {

    static async getProjectInfo(projectPaths: string[]) {
        for (const cwd of projectPaths) {
            try {
                const options = <any>{
                    cwd
                };
                const version = this.validateProjectSettings(cwd);
                if (version === LATEST_VERSION_PLACEHOLDER) {
                    options.frameworkOptions = {
                        versionOverride: "latest"
                    }
                }
                return normalizer.generateProjectTree(options);
            } catch (error: any) {
                log.info(`${error.message}`);
            }
        }
    }

    static validateProjectSettings(projectPath: string): string {
        const FRAMEWORK_TYPES = ["OpenUI5", "SAPUI5"];
        const content = fs.readFileSync(path.join(projectPath, "ui5.yaml"), { encoding: "utf-8" });
        const yamlJson = <any>yaml.load(content);
        const framework = yamlJson["framework"];
        if (!FRAMEWORK_TYPES.includes(framework.name)) {
            throw new Error(`UI5 framework name is incorrect, possible values: ${FRAMEWORK_TYPES.join(" or ")}`);
        }
        if (!semver.valid(framework.version)) {
            throw new Error(`UI5 framework version should correspond semantic version standard, e.g: 1.85.2`);
        }
        return framework.version;
    }

    static getBundledUI5Version(destination: string) {
        const bundleFilePath = path.join(process.cwd(), destination);
        if (fs.existsSync(bundleFilePath)) {
            const bundle = fs.readFileSync(bundleFilePath, { encoding: "utf-8" });
            const version = bundle.substring(2, bundle.indexOf("\n"));
            return semver.coerce(version);
        }
    }

    static async run(): Promise<void> {
        const project = await this.getProjectInfo(projectPaths);
        if (!project) {
            throw new Error("ui5.yaml is not found or incorrect");
        }
        await Bundler.run(
            project,
            "bundleDefinition.js",
            "./dist/bundle.js",
            "/sap.ui.fl",
            [
                "/resources/sap/ui/fl/**",
                "/resources/sap/suite/ui/generic/template/**"
            ],
            [
                "sap/ui/thirdparty/URI"
            ]);
    }
}

if (process.argv.length === 2) {
    Builder.run();
}
