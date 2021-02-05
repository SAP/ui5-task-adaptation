//@ts-check
const path = require("path");
const ui5 = require("./rollup/ui5-resolve");
const builtins = require('builtin-modules');
const { terser } = require("rollup-plugin-terser");
const { nodeResolve } = require("@rollup/plugin-node-resolve");

module.exports = {
    input: "./rollup/bundle-def.js",
    plugins: [
        ui5({
            assets: [
                "/resources/sap/ui/fl/**"
            ],
            skipTransformation: [
                "./rollup/bundle-def.js",
                "sap/ui/thirdparty/URI"
            ],
            projectPaths: [
                path.resolve(__dirname, "..", "..", ".."),
                path.resolve(__dirname, "rollup", "project")
            ]
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