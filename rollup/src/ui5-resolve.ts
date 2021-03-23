import * as fs from "fs";
import * as path from "path";
import * as semver from "semver";
import * as stream from "stream";
import * as yaml from "js-yaml";

import CodeTransformer from "./codeTransformer";
import { promisify } from "util";

const pipe = promisify(stream.pipeline);
const convertAMDtoES6 = require("@buxlabs/amd-to-es6");
const log = require("@ui5/logger").getLogger("rollup-plugin-ui5-resolve-task-adaptation");
const normalizer = require("@ui5/project").normalizer;
const resourceFactory = require("@ui5/fs").resourceFactory;


export default function (options: any) {

    const skipTransformation = (id: string) => !options.skipTransformation.includes(id);
    let dependencies: any;

    async function getProject(projectPaths: string[]) {
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

    function validateProjectSettings(projectPath: string) {
        const FRAMEWORK_TYPES = ["OpenUI5", "SAPUI5"];
        const content = fs.readFileSync(path.join(projectPath, "ui5.yaml"), { encoding: "utf-8" });
        const yamlJson: any = yaml.load(content);
        if (!FRAMEWORK_TYPES.includes(yamlJson?.framework?.name)) {
            throw new Error(`UI5 framework name is incorrect, possible values: ${FRAMEWORK_TYPES.join(" or ")}`);
        }
        if (!semver.valid(yamlJson?.framework?.version)) {
            throw new Error(`UI5 framework version should correspond semantic version standard, e.g: 1.85.2`);
        }
    }


    return {

        name: "ui5-resolve",

        buildStart: async () => {

            const project = await getProject(options.projectPaths);
            dependencies = resourceFactory.createCollectionsForTree(project, {}).dependencies;

            const resources: any[] = await Promise.all(options.assets.map((asset: string) => dependencies.byGlob(asset)));
            const writePromises = [].concat(...resources).map((resource: any) => {
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
        renderChunk: (code: string) => "var window = {};" + code,


        resolveId: (source: string, importer: string) => {
            log.verbose(`resolveId: ${source} from ${importer}`);
            if (importer && source.startsWith(".")) {
                source = path.posix.join(path.dirname(importer), source);
            }
            log.verbose(" --> resolve to: " + source);
            return source;
        },


        load: async (id: string) => {
            log.verbose(`load: ${id}`);

            const localFile = path.join(process.cwd(), id);
            if (fs.existsSync(localFile)) {
                log.info(`Using local file "${localFile}"`);
                return fs.readFileSync(localFile, {
                    encoding: "utf8"
                });
            }

            const localOverride = path.resolve(__dirname, "..", "overrides", id + ".js");
            if (fs.existsSync(localOverride)) {
                log.info(`Using local override for "${id}"`);
                return fs.readFileSync(localOverride, {
                    encoding: "utf8"
                });
            }

            const resource = await dependencies.byPath(`/resources/${id}.js`);
            return resource.getString();
        },


        transform: (code: string, id: string) => {
            const skipped = !skipTransformation(id);
            log.verbose(`transform: ${id} ${skipped ? "skipped" : ""}`);
            if (skipped) {
                return;
            }

            code = CodeTransformer.transform(code);

            return convertAMDtoES6(code);
        }

    };
};