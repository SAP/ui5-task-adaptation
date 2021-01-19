const ui5 = require("./ui5-resolve");
const builtins = require('builtin-modules');
const { terser } = require("rollup-plugin-terser");
const { nodeResolve } = require("@rollup/plugin-node-resolve");

class ConfigBuilder {
    static build(projectPath) {
        return {
            input: "./rollup/bundle-def.js",
            plugins: [
                ui5({
                    assets: [
                        "/resources/sap/ui/fl/**"
                    ],
                    exclude: [
                        "./rollup/bundle-def.js",
                        "sap/ui/thirdparty/URI"
                    ],
                    projectPath
                }),
                nodeResolve({
                    preferBuiltins: true
                }),
                terser({
                    numWorkers: 1
                })
            ],
            external: builtins,
            output: [
                {
                    file: "./dist/bundle.js",
                    format: "commonjs"
                }
            ]
        };
    }
}

module.exports = ConfigBuilder;