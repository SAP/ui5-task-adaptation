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
    path.resolve(process.cwd(), "..", "..", "..", ".."),
    path.resolve(__dirname, "rollup", "project")
];

export default class Builder {

    static async getProjectInfo(projectPaths: string[]) {
        for (const cwd of projectPaths) {
            try {
                let options = { cwd };
                const project = await normalizer.generateProjectTree(options);
                const ui5Version = this.validateProjectSettings(cwd);
                return { project, ui5Version };
            } catch (error: any) {
                log.info(`${error.message}`);
            }
        }
    }

    static validateProjectSettings(projectPath: string) {
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
        return semver.coerce(framework.version);
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
        const projectInfo = await this.getProjectInfo(projectPaths);
        if (!projectInfo) {
            throw new Error("ui5.yaml is not found or incorrect");
        }
        if (bundledUI5Version == null || projectInfo.ui5Version == null || semver.lt(bundledUI5Version, projectInfo.ui5Version)) {
            log.info(`[ROLLUP] New UI5 version ${projectInfo.ui5Version!.toString()} available to bundle`);
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
                        project: projectInfo.project,
                        ui5version: projectInfo.ui5Version
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
            log.info(`[ROLLUP] UI5 version ${bundledUI5Version!.toString()} is already bundled`);
        }

    }
}

if (process.argv.length === 3) {
    Builder.run(process.argv[2]);
}