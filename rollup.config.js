//@ts-check
const path = require("path");
const ui5 = require("./rollup/ui5-resolve");
const builtins = require("builtin-modules");
const { nodeResolve } = require("@rollup/plugin-node-resolve");

module.exports = {
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
            projectPaths: [
                {
                    cwd: path.resolve(__dirname, "..", "..", ".."),
                },
                {
                    cwd: path.resolve(__dirname, "rollup", "project"),
                    useLatestVersion: true
                }
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