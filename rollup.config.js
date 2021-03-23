//@ts-check
const path = require("path");
const { default: ui5 } = require("./rollup/dist/ui5-resolve");
const builtins = require("builtin-modules");
const { nodeResolve } = require("@rollup/plugin-node-resolve");
const copy = require("rollup-plugin-copy");

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
        //@ts-ignore
        copy({
            targets: [
                { src: "rollup/bundle.d.ts", dest: "dist" }
            ]
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