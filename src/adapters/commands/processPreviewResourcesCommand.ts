import { PostCommand } from "./command.js";
import { stringToBuffer, bufferToString } from "../../util/commonUtil.js";
import { getLogger } from "@ui5/logger";
import { fetchCredentialsAndEnhanceRoutes, merge, XSAPP_JSON_FILENAME } from "../../util/cf/xsAppJsonUtil.js";
import ResourceUtil from "../../util/resourceUtil.js";
import { REUSE_DIR } from "../../model/configuration.js";
import { FetchFilesPromise, ServiceCredentials } from "../../model/types.js";
const log = getLogger("@ui5/task-adaptation::ProcessPreviewResourcesCommand");


export default class ProcessPreviewResourcesCommand extends PostCommand {
    constructor(
        private serviceCredentialsPromise: Promise<ServiceCredentials | undefined>,
        private previewPromise: Promise<FetchFilesPromise | undefined>,
    ) {
        super();
    }

    async execute(files: Map<string, Buffer>): Promise<void> {
        log.verbose(`Downloading reuse libraries to reuse folder`);
        const baseAppXsAppJsonBuffer = files.get(XSAPP_JSON_FILENAME);
        const baseAppXsAppJson = baseAppXsAppJsonBuffer ? bufferToString(baseAppXsAppJsonBuffer) : undefined;
        const mergedFiles = await this.collectReuseLibFiles(await this.previewPromise, baseAppXsAppJson);
        const xsAppJson = mergedFiles.get(XSAPP_JSON_FILENAME);
        if (xsAppJson) {
            const enhanced = await fetchCredentialsAndEnhanceRoutes(bufferToString(xsAppJson), this.serviceCredentialsPromise);
            mergedFiles.set(XSAPP_JSON_FILENAME, stringToBuffer(enhanced));
        }
        if (mergedFiles.size === 0) {
            return;
        }
        await ResourceUtil.writeInProject(REUSE_DIR, mergedFiles);
    }


    private async collectReuseLibFiles(fetchLibsPromises: FetchFilesPromise | undefined, baseAppXsAppJson: string | undefined): Promise<Map<string, Buffer>> {
        let mergedXsAppJson = baseAppXsAppJson;
        const mergedFiles = new Map<string, Buffer>();
        if (!fetchLibsPromises) {
            log.verbose("No reuse libraries defined in ui5AppInfo.json for preview");
            return mergedFiles;
        }
        for (const [libName, libFilesPromise] of fetchLibsPromises) {
            const libFiles = await libFilesPromise;
            if (!libFiles || libFiles.size === 0) {
                log.warn(`No files found in reuse library ${libName} for preview`);
                continue;
            }
            for (const [filename, content] of libFiles) {
                if (filename.endsWith(XSAPP_JSON_FILENAME)) {
                    const xsAppText = bufferToString(content);
                    mergedXsAppJson = mergedXsAppJson ? merge([xsAppText, mergedXsAppJson]) : xsAppText;
                }
                mergedFiles.set(filename, content);
            }
        }
        if (mergedXsAppJson) {
            mergedFiles.set(XSAPP_JSON_FILENAME, stringToBuffer(mergedXsAppJson));
        }
        return mergedFiles;
    }
}
