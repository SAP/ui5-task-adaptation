import * as rollup from "rollup";
import * as builtins from "builtin-modules";
import ui5 from "./rollup/ui5Resolve";
import { nodeResolve } from "@rollup/plugin-node-resolve";


export default abstract class Bundler {

    static async run(project: any, input: string, output: string,
        assets: string[], skipTransformation?: string[]): Promise<void> {
        if (skipTransformation == null) {
            skipTransformation = [];
        }
        if (skipTransformation.includes(input) === false) {
            skipTransformation.push(input);
        }
        await this.bundle(project, input, output, assets, skipTransformation);
    }

    private static async bundle(project: any, input: string, output: string,
        assets: string[], skipTransformation: string[]): Promise<void> {
        const inputOptions = <rollup.RollupOptions>{
            input,
            plugins: [
                ui5({
                    assets,
                    skipTransformation,
                    output,
                    project
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
}
