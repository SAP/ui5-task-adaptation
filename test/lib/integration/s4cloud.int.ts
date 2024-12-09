import * as fs from "fs";
import * as path from "path";
import * as taskRepository from "@ui5/builder/internal/taskRepository";

import { readFile, readdir } from "node:fs/promises";

import { expect } from "chai";
import { graphFromPackageDependencies } from "@ui5/project/graph";

const newLineRegexp = /\r?\n|\r/g;

const __dirname = import.meta.dirname;
const applicationAPath = path.join(__dirname, "..", "..", "fixtures", "application01");

describe("S4/Cloud ", () => {

    it("Build application01", async () => {
        const destPath = "./test/fixtures/application01/dist";
        const expectedPath = path.join(__dirname, "..", "..", "expected", "build", "application01");

        fs.rmSync(destPath, { recursive: true, force: true });
        const graph = await graphFromPackageDependencies({
            cwd: applicationAPath
        });
        graph.setTaskRepository(taskRepository);
        await graph.build({
            destPath,
            excludedTasks: ["generateFlexChangesBundle", "generateComponentPreload", "minify"]
        });

        const expectedFiles = await findFiles(expectedPath);
        // Check for all directories and files
        await directoryDeepEqual(destPath, expectedPath);
        // Check for all file contents
        await checkFileContentsIgnoreLineFeeds(expectedFiles, expectedPath, destPath);
    });
});

async function findFiles(dirPath: string) {
    const files = await readdir(dirPath, { withFileTypes: true, recursive: true });
    return files.filter((file) => file.isFile()).map((file) => path.join(file.path, file.name));
}

async function directoryDeepEqual(destPath: string, expectedPath: string) {
    const dest = await readdir(destPath, { recursive: true });
    const expected = await readdir(expectedPath, { recursive: true });
    let diff = dest.filter(item => !expected.includes(item)).concat(expected.filter(item => !dest.includes(item)));
    expect(dest, diff.join(", ")).to.eql(expected);
}

async function checkFileContentsIgnoreLineFeeds(expectedFiles: string[], expectedPath: string, destPath: string) {
    for (let i = 0; i < expectedFiles.length; i++) {
        const expectedFile = expectedFiles[i];
        const relativeFile = path.relative(expectedPath, expectedFile);
        const destFile = path.join(destPath, relativeFile);
        const currentFileContentPromise = readFile(destFile, "utf8");
        const expectedFileContentPromise = readFile(expectedFile, "utf8");
        const assertContents = ([currentContent, expectedContent]: string[]) => {
            if (expectedFile.endsWith("sap-ui-cachebuster-info.json")) {
                currentContent = JSON.parse(currentContent.replace(/(:\s+)(\d+)/g, ": 0"));
                expectedContent = JSON.parse(expectedContent.replace(/(:\s+)(\d+)/g, ": 0"));
                expect(currentContent).to.eql(expectedContent);
            } else {
                if (expectedFile.endsWith(".json")) {
                    expect(JSON.parse(currentContent), expectedFile).to.eql(JSON.parse(expectedContent));
                }
                // TODO: annotation keys and default language is not generated consistently, should be checked after the fix
                if (!expectedFile.endsWith(".properties") && !expectedFile.endsWith(".xml")) {
                    expect(currentContent.replace(newLineRegexp, "\n"), relativeFile).to.eql(expectedContent.replace(newLineRegexp, "\n"));
                }
            }
        };
        await Promise.all([currentFileContentPromise, expectedFileContentPromise]).then(assertContents);
    }
}