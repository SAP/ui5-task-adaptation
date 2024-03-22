import * as fs from "fs";
import * as path from "path";
import * as semver from "semver";
import * as yaml from "js-yaml";
import Bundler from "./rollup/bundler.js";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import * as resourceFactory from "@ui5/fs/resourceFactory";
import { graphFromPackageDependencies } from "@ui5/project/graph";
import { getLogger } from "@ui5/logger";

const log = getLogger("rollup-plugin-ui5-resolve-task-adaptation");
const __dirname = dirname(fileURLToPath(import.meta.url));

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
                    options.versionOverride = "latest";
                }
                return await graphFromPackageDependencies(options);
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

    static async getResources(namespaces: Map<string, string[]>, projectGraph: any): Promise<Map<string, any>> {
        const fsBasePaths = new Set<string>();
        const adapters = new Map<string, any>();
        for (const project of [...projectGraph.getProjects("rollup")]) {
            const fsBasePath = project.getSourcePath();
            if (!fsBasePaths.has(fsBasePath)) {
                adapters.set(project.getNamespace(), resourceFactory.createReader({
                    fsBasePath,
                    virBasePath: "/resources/"
                }));
                fsBasePaths.add(fsBasePath);
            }
        }

        const resources = new Map<string, any>();
        for (const [namespace, adapter] of adapters.entries()) {
            const patterns = namespaces.get(namespace);
            if (patterns) {
                for (const pattern of patterns) {
                    const result = await adapter.byGlob(pattern) as any[];
                    result.forEach(resource => resources.set(resource.getPath(), resource));
                }
            }
        }

        return resources;
    }

    static copyTypeDefinition() {
        fs.copyFileSync(path.join(__dirname, "rollup", "bundle.d.ts"), path.join(process.cwd(), "dist", "bundle.d.ts"))
    }

    static async run(): Promise<void> {
        const project = await this.getProjectInfo(projectPaths);
        if (!project) {
            throw new Error("ui5.yaml is not found or incorrect");
        }
        const namespaces = new Map([
            ["sap/fe/core", [
                "/resources/sap/fe/core/**"
            ]],
            ["sap/ui/fl", [
                "/resources/sap/ui/fl/**"
            ]],
            ["sap/ui/core", [
                "/resources/ui5loader-autoconfig.js",
                "/resources/sap/base/**",
                "/resources/sap/ui/{base,thirdparty,model}/**"
            ]],
            ["sap/suite/ui/generic/template", [
                "/resources/sap/suite/ui/generic/template/**"
            ]]
        ]);
        const resources = await this.getResources(namespaces, project);
        await Bundler.run(
            resources,
            "bundleDefinition.js",
            "./dist/bundle.js",
            [
                "sap/ui/performance/Measurement",
                "sap/base/config.js"
            ]
        );
        this.copyTypeDefinition();
    }
}

if (process.argv.length === 2) {
    const start = Date.now();
    await Builder.run();
    log.info(`Bundled in ${Date.now() - start} ms`);
}
