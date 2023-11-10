import * as fs from "fs";
import { posix as path } from "path";
import * as semver from "semver";
import * as rollup from "rollup";
import * as builtins from "builtin-modules";
import ui5 from "./rollup/ui5Resolve";
import { nodeResolve } from "@rollup/plugin-node-resolve";

const log = require("@ui5/logger").getLogger("rollup-plugin-ui5-resolve-task-adaptation");

export default abstract class Bundler {

    static async run(project: any, input: string, output: string, namespace: string,
        assets: string[], skipTransformation?: string[]): Promise<void> {
        if (skipTransformation == null) {
            skipTransformation = [];
        }
        if (skipTransformation.includes(input) === false) {
            skipTransformation.push(input);
        }
        const bundledUI5Version = this.getBundledUI5Version(output);
        const ui5version = this.getVersion(project, namespace);
        if (bundledUI5Version == null || ui5version && semver.neq(bundledUI5Version, ui5version)) {
            if (ui5version) {
                log.info(`Using UI5 version ${ui5version.toString()} to bundle`);
            }
            await this.bundle(project, input, output, assets, skipTransformation, ui5version);
        } else {
            log.info(`UI5 version ${bundledUI5Version!.toString()} is already bundled`);
        }
    }

    private static async bundle(project: any, input: string, output: string,
        assets: string[], skipTransformation: string[], ui5version: string): Promise<void> {
        const inputOptions = <rollup.RollupOptions>{
            input,
            plugins: [
                ui5({
                    assets,
                    skipTransformation,
                    output,
                    project,
                    ui5version
                }),
                nodeResolve({
                    preferBuiltins: true
                })
            ],
            external: builtins
        };
        const bundle = await rollup.rollup(inputOptions);

        const outputOptions = <rollup.RollupOptions>{
            file: output,
            format: "commonjs"
        };
        await bundle.write(outputOptions);
        await bundle.close();
    }

    private static getBundledUI5Version(output: string) {
        const bundleFilePath = path.join(process.cwd(), output);
        if (fs.existsSync(bundleFilePath)) {
            const bundle = fs.readFileSync(bundleFilePath, { encoding: "utf-8" });
            const version = bundle.substring(2, bundle.indexOf("\n"));
            return semver.coerce(version);
        }
    }

    private static getVersion(project: any, namespace: string): string {
        const isModule = (dependency: any) => dependency.id.endsWith(namespace);
        const sapUiFlDependency = project.dependencies.find(isModule);
        return sapUiFlDependency && sapUiFlDependency.version;
    }
}
