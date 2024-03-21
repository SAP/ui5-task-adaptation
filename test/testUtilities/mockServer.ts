import * as fs from "fs";

import AbapRepoManager from "../../src/repositories/abapRepoManager.js";
import ServerError from "../../src/model/serverError.js";
import { SinonSandbox } from "sinon";
import TestUtil from "./testUtil.js";
import { posix as path } from "path";

export default class MockServer {

    static stubAnnotations(sandbox: SinonSandbox, abapRepoManager: AbapRepoManager, annotationFolders: IAnnotationFolder[], numberOfFailedRequests?: number) {
        const stub = sandbox.stub(abapRepoManager, "downloadAnnotationFile" as any);
        const regex = /\w+-([a-z]*).xml/gi;
        for (const { folder, url } of annotationFolders) {
            const defaultServerError = new ServerError(url, { response: { status: 500 } });
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
                    if (numberOfFailedRequests) {
                        for (let i = 0; i < numberOfFailedRequests; i++) {
                            stub.withArgs(languageUrl).onCall(i).rejects(defaultServerError);
                        }
                    }
                    stub.withArgs(languageUrl).resolves(map);
                    filesPerLanguage.set(match[1].toUpperCase(), Promise.resolve(map));
                }
            }
            if (numberOfFailedRequests) {
                for (let i = 0; i < numberOfFailedRequests; i++) {
                    stub.withArgs(url).onCall(i).rejects(defaultServerError);
                }
            }
            stub.withArgs(url).resolves(MockServer.getDefaultJson(filesPerLanguage));
        }
        return stub;
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