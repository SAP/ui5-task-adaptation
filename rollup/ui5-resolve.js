const path = require("path");
const fs = require("fs");
const stream = require("stream");
const { promisify } = require("util");
const pipe = promisify(stream.pipeline);

const convertAMDtoES6 = require("@buxlabs/amd-to-es6");
const amdextract = require("amdextract");

const log = require("@ui5/logger").getLogger("rollup-plugin-ui5-resolve");
const normalizer = require("@ui5/project").normalizer;
const resourceFactory = require("@ui5/fs").resourceFactory;


module.exports = (options) => {

    log.verbose(JSON.stringify(options, undefined, 2));

    const filter = (id) => !options.exclude.includes(id);

    return {

        name: "ui5-resolve",

        buildStart: async (buildOptions) => {
            const project = await normalizer.generateProjectTree({
                cwd: options.projectPath
            });
            this.dependencies = resourceFactory.createCollectionsForTree(project, {}).dependencies;

            const resources = await this.dependencies.byGlob("/resources/sap/ui/fl/**");
            const writePromises = resources.map(resource => {
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


        // Right before writting result to dist
        renderChunk: async (code) => {
            return "global.window = {};" + code;
        },


        buildEnd: async (error) => {
            log.verbose("buildEnd", error);
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
            const skipped = !filter(id);
            log.verbose(`transform: ${id} ${skipped ? "skipped" : ""}`);
            if (skipped) {
                return;
            }
            code = code
                .replace(/sap\.ui\.define/g, "define")
                .replace(/\, \/\* bExport\= \*\/ true\)/g, ")")
                .replace(/}, true\);$/g, "});");

            if (code) {
                try {
                    const result = amdextract.parse(code);
                    if (result.results.length > 0 && result.results[0].unusedPaths.length > 0) {
                        log.error(`Module "${id}" has unused paths: ${result.results[0].unusedPaths}`);
                    }
                } catch (e) {
                    log.error(`Failed to check module "${id}": ${e.message}`);
                }
                code = convertAMDtoES6(code);
            }
            return code;
        }

    };
};