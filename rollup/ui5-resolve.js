//@ts-check
const path = require("path");
const fs = require("fs");
const stream = require("stream");
const { promisify } = require("util");
const pipe = promisify(stream.pipeline);
const yaml = require("js-yaml");
const semver = require("semver");
const crypto = require("crypto");

const convertAMDtoES6 = require("@buxlabs/amd-to-es6");

const log = require("@ui5/logger").getLogger("rollup-plugin-ui5-resolve-task-adaptation");
const normalizer = require("@ui5/project").normalizer;
const resourceFactory = require("@ui5/fs").resourceFactory;


module.exports = (options) => {

    const skipTransformation = (id) => !options.skipTransformation.includes(id);

    async function getProject(projectPaths) {
        for (const cwd of projectPaths) {
            try {
                const project = await normalizer.generateProjectTree({ cwd });
                validateProjectSettings(cwd);
                return project;
            } catch (error) {
                log.info(`${error.message}`);
            }
        }
    }

    function validateProjectSettings(projectPath) {
        const FRAMEWORK_TYPES = ["OpenUI5", "SAPUI5"];
        const content = fs.readFileSync(path.join(projectPath, "ui5.yaml"), { encoding: "utf-8" });
        const framework = yaml.load(content)["framework"];
        if (!FRAMEWORK_TYPES.includes(framework.name)) {
            throw new Error(`UI5 framework name is incorrect, possible values: ${FRAMEWORK_TYPES.join(" or ")}`);
        }
        if (!semver.valid(framework.version)) {
            throw new Error(`UI5 framework version should correspond semantic version standard, e.g: 1.85.2`);
        }
    }


    return {

        name: "ui5-resolve",

        buildStart: async (buildOptions) => {

            const project = await getProject(options.projectPaths);
            this.dependencies = resourceFactory.createCollectionsForTree(project, {}).dependencies;

            const resources = await Promise.all(options.assets.map(asset => this.dependencies.byGlob(asset)));
            const writePromises = [].concat(...resources).map(resource => {
                const file = `./dist${resource.getPath()}`;
                const folder = path.dirname(file);
                if (!fs.existsSync(folder)) {
                    fs.mkdirSync(folder, { recursive: true });
                }
                if (fs.existsSync(file)) {
                    fs.unlinkSync(file);
                }
                return pipe(resource.getStream(), fs.createWriteStream(file));
            });
            await Promise.all(writePromises);
        },


        /*
         * Right before writing result to dist
         */
        renderChunk: async (code) => {
            return "var window = {};" + code;
        },


        resolveId: (source, importer) => {
            log.verbose(`resolveId: ${source} from ${importer}`);
            if (importer && source.startsWith(".")) {
                source = path.posix.join(path.dirname(importer), source);
            }
            log.verbose(" --> resolve to: " + source);
            return source;
        },


        load: async (id) => {
            log.verbose(`load: ${id}`);

            const localFile = path.join(process.cwd(), id);
            if (fs.existsSync(localFile)) {
                log.info(`Using local file "${localFile}"`);
                return fs.readFileSync(localFile, {
                    encoding: "utf8"
                });
            }

            const localOverride = path.resolve(__dirname, "overrides", id + ".js");
            if (fs.existsSync(localOverride)) {
                log.info(`Using local override for "${id}"`);
                return fs.readFileSync(localOverride, {
                    encoding: "utf8"
                });
            }

            const resource = await this.dependencies.byPath(`/resources/${id}.js`);
            return resource.getString();
        },


        transform: (code, id) => {
            const skipped = !skipTransformation(id);
            log.verbose(`transform: ${id} ${skipped ? "skipped" : ""}`);
            if (skipped) {
                return;
            }

            code = replaceRequireAsync(code);

            code = code
                .replace(/sap\.ui\.define/g, "define")
                .replace(/\, \/\* bExport\= \*\/ true\)/g, ")")
                .replace(/}, true\);$/g, "});");
            return convertAMDtoES6(code);
        }

    };
};


function replaceRequireAsync(code) {
    const requireAsyncPattern = /requireAsync\("(?<url>[\/\w]*)"\)/mg;
    let match, defineUrls = [], defineVars = [], matches = new Map();
    while (match = requireAsyncPattern.exec(code)) {
        const varaibleName = match.groups.url.split("/").pop() + crypto.randomBytes(16).toString("hex");
        defineUrls.push(`"${match.groups.url}"`);
        defineVars.push(varaibleName);
        matches.set(match[0], varaibleName);
    }
    if (defineUrls.length * defineVars.length > 0) {
        matches.forEach((value, key) => code = code.replace(key, value));
    }
    if (defineUrls.length > 0 && defineVars.length > 0) {
        code = replaceRequireAsyncWith(code, `"sap/ui/fl/requireAsync"`, defineUrls);
        code = replaceRequireAsyncWith(code, "requireAsync", defineVars);
    }
    return code;
}


function replaceRequireAsyncWith(code, requireAsyncSearchKeyword, inserts) {
    return code.replace(requireAsyncSearchKeyword, inserts.join(",\n\t"));
}