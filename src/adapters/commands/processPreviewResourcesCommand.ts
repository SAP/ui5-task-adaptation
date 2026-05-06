import { PostCommand } from "./command.js";
import { getLogger } from "@ui5/logger";
import { merge, XSAPP_JSON_FILENAME } from "../../util/cf/xsAppJsonUtil.js";
import ResourceUtil from "../../util/resourceUtil.js";
import { REUSE_DIR } from "../../model/configuration.js";
import { FetchFilesPromise, ServiceCredentials } from "../../model/types.js";
import XsAppJsonEnhanceRoutesCommand from "./xsAppJsonEnhanceRoutesCommand.js";
const log = getLogger("@ui5/task-adaptation::ProcessPreviewResourcesCommand");


export default class ProcessPreviewResourcesCommand extends PostCommand {
    constructor(
        private serviceCredentialsPromise: Promise<ServiceCredentials | undefined>,
        private previewPromise: Promise<FetchFilesPromise | undefined>,
    ) {
        super();
    }

    async execute(files: Map<string, string>): Promise<void> {
        log.verbose(`Downloading reuse libraries to reuse folder`);
        const baseAppXsAppJson = files.get(XSAPP_JSON_FILENAME);
        const mergedFiles = await this.collectReuseLibFiles(await this.previewPromise, baseAppXsAppJson);
        new XsAppJsonEnhanceRoutesCommand(this.serviceCredentialsPromise).execute(mergedFiles);
        if (mergedFiles.size === 0) {
            return;
        }
        await ResourceUtil.writeInProject(REUSE_DIR, mergedFiles);
    }


    private async collectReuseLibFiles(fetchLibsPromises: FetchFilesPromise | undefined, mergedXsAppJson: string | undefined): Promise<Map<string, string>> {
        const mergedFiles = new Map<string, string>();
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
                    mergedXsAppJson = mergedXsAppJson ? merge([content, mergedXsAppJson]) : content;
                }
                mergedFiles.set(filename, content);
            }
        }
        if (mergedXsAppJson) {
            mergedFiles.set(XSAPP_JSON_FILENAME, mergedXsAppJson);
        }
        return mergedFiles;
    }
}
