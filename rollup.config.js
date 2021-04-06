//@ts-check
const path = require("path");
const ui5 = require("./rollup/ui5-resolve");
const builtins = require("builtin-modules");
const { nodeResolve } = require("@rollup/plugin-node-resolve");

const FALLBACK_PROJECT_FOLDER = path.resolve(__dirname, "rollup", "project");

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
                FALLBACK_PROJECT_FOLDER
            ]
        }),
        nodeResolve({
            preferBuiltins: true
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