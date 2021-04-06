//@ts-check
const path = require("path");
const ui5 = require("./rollup/ui5-resolve");
const updateUI5Version = require("./rollup/ui5-version");
const builtins = require("builtin-modules");
const { nodeResolve } = require("@rollup/plugin-node-resolve");

const FALLBACK_PROJECT_FOLDER = path.resolve(__dirname, "rollup", "project");

module.exports = {
    input: "./rollup/bundle-def.js",
    plugins: [
        updateUI5Version({
            uri: "https://ui5.sap.com/neo-app.json",
            projectPath: path.join(FALLBACK_PROJECT_FOLDER, "ui5.yaml")
        }),
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