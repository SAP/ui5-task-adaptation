import IAnnotationManager from "./annotationManager.js";

export default class CFAnnotationManager implements IAnnotationManager {
    async process(_baseAppManifest: any, _appVariantId: string, _prefix: string): Promise<Map<string, string>> {
        // No annotation processing needed for cf
        return new Map();
    }
}
