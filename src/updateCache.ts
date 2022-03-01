import HTML5RepoManager from "./html5RepoManager";
import { IConfiguration } from "./model/types";
import ResourceUtil from "./util/resourceUtil";
import { validateObject } from "./util/commonUtil";

/**
 * Updates temporary stored original app files
 */
export default async function (configuration: IConfiguration): Promise<Map<string, string>> {
    validateObject(configuration, ["appHostId", "appName", "appVersion"], "should be specified in ui5.yaml configuration");
    const metadataPromise = HTML5RepoManager.getMetadata(configuration);
    const tempMetadata = ResourceUtil.readTempMetadata(configuration);
    const metadata = await metadataPromise;
    if (metadata.changedOn !== tempMetadata?.changedOn) {
        const baseAppFiles = await HTML5RepoManager.getBaseAppFiles(configuration);
        const metadataMap = new Map([[ResourceUtil.METADATA_FILENAME, JSON.stringify(metadata)]]);
        await ResourceUtil.writeTemp(configuration, new Map([...baseAppFiles, ...metadataMap]));
        return baseAppFiles;
    } else {
        return ResourceUtil.readTemp(configuration);
    }
}