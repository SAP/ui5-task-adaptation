export default interface ICachedResource {
    appName: string;
    cacheBusterToken: Promise<string>;
}