const path = require("path");
const fs = require("fs");
const stream = require("stream");
const { promisify } = require("util");
const pipe = promisify(stream.pipeline);

const convertAMDtoES6 = require("@buxlabs/amd-to-es6");

const log = require("@ui5/logger").getLogger("rollup-plugin-ui5-resolve-task-adaptation");
const normalizer = require("@ui5/project").normalizer;
const resourceFactory = require("@ui5/fs").resourceFactory;


module.exports = (options) => {

    const skipTransformation = (id) => !options.skipTransformation.includes(id);

    return {

        name: "ui5-resolve",

        buildStart: async (buildOptions) => {
            const project = await normalizer.generateProjectTree({
                cwd: options.projectPath
            });
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
            code = code
                .replace(/sap\.ui\.define/g, "define")
                .replace(/\, \/\* bExport\= \*\/ true\)/g, ")")
                .replace(/}, true\);$/g, "});");
            return convertAMDtoES6(code);
        }

    };
};