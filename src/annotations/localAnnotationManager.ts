import IAnnotationManager from "./annotationManager.js";

export default class LocalAnnotationManager implements IAnnotationManager {
    async process(_baseAppManifest: any, _appVariantId: string, _prefix: string): Promise<Map<string, string>> {
        // No annotation processing needed for local
        return new Map<string, string>();
    }
}
