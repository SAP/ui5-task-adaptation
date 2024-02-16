import * as fs from "fs";

import AbapRepoManager from "../../src/repositories/abapRepoManager";
import { SinonSandbox } from "sinon";
import TestUtil from "./testUtil";
import { posix as path } from "path";

export default class MockServer {

    static stubAnnotations(sandbox: SinonSandbox, abapRepoManager: AbapRepoManager, annotationFolders: IAnnotationFolder[]) {
        const stub = sandbox.stub(abapRepoManager, "downloadAnnotationFile" as any);
        const regex = /\w+-([a-z]*).xml/gi;
        for (const { folder, url } of annotationFolders) {
            const filesPerLanguage = new Map<string, Promise<Map<string, string>>>();
            const annotations = fs.readdirSync(TestUtil.getResourcePath(folder));
            for (const annotation of annotations) {
                const matches = annotation.matchAll(regex);
                for (const match of matches) {
                    let languageUrl = url;
                    if (match[1] !== "") {
                        languageUrl += "?sap-language=" + match[1].toUpperCase();
                    }
                    const filename = path.join(TestUtil.getResourcePath(folder), annotation);
                    const map = new Map([["annotation.xml", fs.readFileSync(filename, { encoding: "utf-8" })]]);
                    stub.withArgs(languageUrl).resolves(map);
                    filesPerLanguage.set(match[1].toUpperCase(), Promise.resolve(map));
                }
            }
            stub.withArgs(url).resolves(MockServer.getDefaultJson(filesPerLanguage));
        }
    }


    private static getDefaultJson(filesPerLanguage: Map<string, Promise<Map<string, string>>>) {
        for (const [language, json] of filesPerLanguage.entries()) {
            for (const defaultLanguage of ["", "EN"]) {
                if (language === defaultLanguage) {
                    return json;
                }
            }
        }
    }
}

export interface IAnnotationFolder {
    folder: string;
    url: string;
}