import * as fs from "fs";
import * as path from "path";

import * as builtins from "builtin-modules";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import * as rollup from "rollup";
import * as semver from "semver";
import * as yaml from "js-yaml";

const ui5 = require("./ui5-resolve");
//@ts-ignore
const { normalizer } = require("@ui5/project");
const log = require("@ui5/logger").getLogger("rollup-plugin-ui5-resolve-task-adaptation");

const OUTPUT_PATH = "./dist/bundle.js";

const projectPaths = [
    path.resolve(process.cwd(), "..", "..", ".."),
    path.resolve(__dirname, "project")
];

export default class RollupBuilder {

    static async getProjectInfo(projectPaths: string[]) {
        for (const cwd of projectPaths) {
            try {
                let options = { cwd };
                const project = await normalizer.generateProjectTree(options);
                const ui5Version = this.validateProjectSettings(cwd);
                return { project, ui5Version };
            } catch (error) {
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

    static getBundledUI5Version() {
        const bundleFilePath = path.join(process.cwd(), OUTPUT_PATH);
        if (fs.existsSync(bundleFilePath)) {
            const bundle = fs.readFileSync(bundleFilePath, { encoding: "utf-8" });
            const version = bundle.substring(2, bundle.indexOf("\n"));
            return semver.coerce(version);
        }
    }

    static async run(): Promise<void> {
        const bundledUI5Version = this.getBundledUI5Version();
        const projectInfo = await this.getProjectInfo(projectPaths);
        if (projectInfo && (bundledUI5Version == null || projectInfo.ui5Version == null ||
            semver.lt(bundledUI5Version, projectInfo.ui5Version))) {
            log.info(`New UI5 version ${projectInfo.ui5Version!.toString()} available. Starting rollup`);
            const inputOptions = <rollup.RollupOptions>{
                input: "./rollup/bundle-def.js",
                plugins: [
                    ui5({
                        assets: [
                            "/resources/sap/ui/fl/**",
                            "/resources/sap/suite/ui/generic/template/**"
                        ],
                        skipTransformation: [
                            "./rollup/bundle-def.js",
                            "sap/ui/thirdparty/URI"
                        ],
                        output: OUTPUT_PATH,
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
                file: OUTPUT_PATH,
                format: "commonjs"
            }
            await bundle.write(outputOptions);
            await bundle.close();
        } else {
            const version = bundledUI5Version || projectInfo?.ui5Version;
            log.info(`UI5 version ${version!.toString()} is already bundled. Skipping rollup`);
        }

    }
}

//RollupBuilder.run();