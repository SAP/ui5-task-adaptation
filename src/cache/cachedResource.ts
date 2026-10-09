export default interface ICachedResource {
    appName: string;
    token: Promise<string>;
    keepAppNameDir?: boolean;
}