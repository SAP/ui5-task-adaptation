import CacheManager from "./cacheManager.js";

export default class BaseAppFilesCacheManager extends CacheManager {

    static METADATA_FILENAME = "html5metadata.json";


    protected getTempId() {
        const { appHostId, appName, appVersion } = this.configuration;
        return super.normalizeId(`ui5-${appHostId}-${appName}-${appVersion}`);
    }


    getMetadataFilename(): string {
        return BaseAppFilesCacheManager.METADATA_FILENAME;
    }

}