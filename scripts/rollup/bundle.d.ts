export declare const RegistrationBuild: () => void;

export declare class Applier {
    static applyChanges(manifest: any, changes: Change[], strategy: any): Promise<void>;
}

export declare class Change {
    constructor(change: any);
    getLayer(): string;
    _oDefinition: any;
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