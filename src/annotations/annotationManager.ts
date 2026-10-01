export default interface IAnnotationManager {
    process(baseAppManifest: any, appVariantId: string, prefix: string): Promise<Map<string, string>>;
}
