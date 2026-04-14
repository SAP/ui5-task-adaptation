export declare const RegistrationBuild: () => void;

export declare class Applier {
    static applyChanges(manifest: any, changes: AppDescriptorChange[], strategy: any): Promise<void>;
}

export declare class AppDescriptorChange {
    constructor(change: any);
    getLayer(): string;
}

export declare class V2MetadataConverter {
    convertXMLMetadata(jsdom: any): any;
}

export declare class V4MetadataConverter {
    convertXMLMetadata(jsdom: any): any;
}

export declare class URI {
    constructor(relativeUrl: string);
    absoluteTo(url: string): string;
    static parse(url: string): { path: string };
}