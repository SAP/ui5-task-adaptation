import * as fs from "fs";
import * as path from "path";

import * as builtins from "builtin-modules";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import * as rollup from "rollup";
import * as semver from "semver";
import * as yaml from "js-yaml";
import ui5 from "./rollup/ui5Resolve";

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

    static async run(destination: string): Promise<void> {
        const bundledUI5Version = this.getBundledUI5Version(destination);
        const project = await this.getProjectInfo(projectPaths);
        if (!project) {
            throw new Error("ui5.yaml is not found or incorrect");
        }
        const isSapUiFl = (dependency: any) => dependency.id.endsWith("/sap.ui.fl");
        const sapUiFlDependency = project.dependencies.find(isSapUiFl);
        if (bundledUI5Version == null || sapUiFlDependency && semver.neq(bundledUI5Version, sapUiFlDependency.version)) {
            if (sapUiFlDependency.version) {
                log.info(`Using UI5 version ${sapUiFlDependency.version.toString()} to bundle`);
            }
            const inputOptions = <rollup.RollupOptions>{
                input: "bundleDefinition.js",
                plugins: [
                    ui5({
                        assets: [
                            "/resources/sap/ui/fl/**",
                            "/resources/sap/suite/ui/generic/template/**"
                        ],
                        skipTransformation: [
                            "bundleDefinition.js",
                            "sap/ui/thirdparty/URI"
                        ],
                        output: destination,
                        project: project,
                        ui5version: sapUiFlDependency.version
                    }),
                    nodeResolve({
                        preferBuiltins: true
                    })
                ],
                external: builtins
            }
            const bundle = await rollup.rollup(inputOptions);

            const outputOptions = <rollup.RollupOptions>{
                file: destination,
                format: "commonjs"
            }
            await bundle.write(outputOptions);
            await bundle.close();
        } else {
            log.info(`UI5 version ${bundledUI5Version!.toString()} is already bundled`);
        }

    }
}

if (process.argv.length === 3) {
    Builder.run(process.argv[2]);
}