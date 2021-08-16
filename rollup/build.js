const rollup = require('rollup');
const path = require("path");
const fs = require("fs");
const yaml = require("js-yaml");
const semver = require("semver");
const ui5 = require("./ui5-resolve");
const builtins = require("builtin-modules");
const nodeResolve = require("@rollup/plugin-node-resolve").nodeResolve;
//@ts-ignore
const normalizer = require("@ui5/project").normalizer;
const log = require("@ui5/logger").getLogger("rollup-plugin-ui5-resolve-task-adaptation");

const OUTPUT_PATH = "./dist/bundle.js";

const projectPaths = [
    {
        cwd: path.resolve(process.cwd(), "..", "..", ".."),
    },
    {
        cwd: path.resolve(__dirname, "project")
    }
];

async function getProjectInfo(projectPaths) {
    for (const { cwd } of projectPaths) {
        try {
            let options = { cwd };
            const project = await normalizer.generateProjectTree(options);
            const ui5Version = validateProjectSettings(cwd);
            return { project, ui5Version };
        } catch (error) {
            log.info(`${error.message}`);
        }
    }
}

function validateProjectSettings(projectPath) {
    const FRAMEWORK_TYPES = ["OpenUI5", "SAPUI5"];
    const content = fs.readFileSync(path.join(projectPath, "ui5.yaml"), { encoding: "utf-8" });
    const framework = yaml.load(content)["framework"];
    if (!FRAMEWORK_TYPES.includes(framework.name)) {
        throw new Error(`UI5 framework name is incorrect, possible values: ${FRAMEWORK_TYPES.join(" or ")}`);
    }
    if (!semver.valid(framework.version)) {
        throw new Error(`UI5 framework version should correspond semantic version standard, e.g: 1.85.2`);
    }
    return semver.coerce(framework.version);
}

function getBundledUI5Version() {
    const bundle = fs.readFileSync(path.join(process.cwd(), OUTPUT_PATH), { encoding: "utf-8" });
    const version = bundle.substring(2, bundle.indexOf("\n"));
    return semver.coerce(version);
}

async function build() {
    const bundledUI5Version = getBundledUI5Version();
    const projectInfo = await getProjectInfo(projectPaths);
    if (bundledUI5Version == null || projectInfo.ui5Version == null ||
        semver.lt(bundledUI5Version, projectInfo.ui5Version)) {
        log.info(`New UI5 version ${projectInfo.ui5Version.toString()} available. Starting rollup`);
        const inputOptions = {
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

        const outputOptions = {
            file: OUTPUT_PATH,
            format: "commonjs"
        }
        await bundle.write(outputOptions);
        await bundle.close();
    } else {
        const version = bundledUI5Version || projectInfo.ui5Version;
        log.info(`UI5 version ${version.toString()} is already bundled. Skipping rollup`);
    }
}

build();