import * as rollup from "rollup";
import * as builtins from "builtin-modules";
import ui5 from "./ui5Resolve.js";
import { nodeResolve } from "@rollup/plugin-node-resolve";


export default abstract class Bundler {

    static async run(resources: Map<string, any>, input: string, output: string, skipTransformation: string[] = []): Promise<void> {
        if (!skipTransformation.includes(input)) {
            skipTransformation.push(input);
        }
        const inputOptions = <rollup.RollupOptions>{
            input,
            plugins: [
                ui5({
                    resources,
                    skipTransformation,
                    output
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
            format: "esm"
        };
        await bundle.write(outputOptions);
        await bundle.close();
    }
}
