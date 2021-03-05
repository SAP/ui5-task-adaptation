import BuildStrategy from "../src/buildStrategy";
import { IChange } from "../src/model/types";

export declare const ApplyUtil: {
    formatBundleName(sId: string, sBundleUrl: string): string;
}

export declare const RegistrationBuild: {}

export declare class Applier {
    static applyChanges(oManifest: any, aAppDescriptorChanges: Change[], mStrategy: BuildStrategy): void;
}

export declare class Change {
    constructor(change: IChange);
    getChangeType(): string;
    getContent(): any;
    getTexts(): string[];
}