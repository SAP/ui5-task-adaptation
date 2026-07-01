import { rename, renameMap, renameResources } from "../../../src/util/renamingUtil.js";

const ITERATIONS = 50;

function generateFileContent(searchTerms: string[], replacement: string, lines: number): string {
    const result: string[] = [];
    for (let i = 0; i < lines; i++) {
        const term = searchTerms[i % searchTerms.length];
        const slashTerm = term.replaceAll(".", "/");
        // Every 10th line contains the replacement (to test ignore logic)
        const alreadyReplaced = i % 10 === 0;
        const id = alreadyReplaced ? replacement : term;
        const slashId = alreadyReplaced ? replacement.replaceAll(".", "/") : slashTerm;
        const templates = [
            `"sap.app": { "id": "${id}", "version": "1.0.${i}" }`,
            `<Component name="${id}" />`,
            `require("${slashId}/Component")`,
            `"dataSources": { "uri": "/sap/${slashId}/service" }`,
            `// Reference to ${id} component`,
            `i18n>${id}.title.key`,
            `"extends": { "component": "${id}" }`,
            `sap.ui.define(["${slashId}/controller/Base"])`,
            `<core:Fragment fragmentName="${id}.view.Main" />`,
            `getManifestEntry("sap.app").id === "${id}"`,
        ];
        result.push(templates[i % templates.length]);
    }
    return result.join("\n");
}

describe("Renaming Performance Test", () => {
    const searchTerms = [
        "com.sap.base.app",
        "com.sap.another.app",
        "com.sap.third.app"
    ];
    const replacement = "customer.ns.com.sap.base.app.variant";

    const NUM_FILES = 20;
    const LINES_PER_FILE = 1000;

    let files: Map<string, string>;
    const results = new Map<string, number>();

    before(() => {
        files = new Map<string, string>();
        for (let i = 0; i < NUM_FILES; i++) {
            files.set(`file${i}.json`, generateFileContent(searchTerms, replacement, LINES_PER_FILE));
        }
    });

    it(`should rename ${NUM_FILES} files x ${LINES_PER_FILE} lines via renameResources (${ITERATIONS} iterations)`, () => {
        let total = 0;
        for (let iter = 0; iter < ITERATIONS; iter++) {
            const start = performance.now();
            renameResources(files, searchTerms, replacement);
            const end = performance.now();
            total += end - start;
        }
        const avg = total / ITERATIONS;
        results.set(`renameResources ${NUM_FILES}x${LINES_PER_FILE}`, avg);
    });

    it(`should rename single file via renameMap with multiple refs (${ITERATIONS} iterations)`, () => {
        const content = generateFileContent(searchTerms, replacement, LINES_PER_FILE);
        const refs = new Map(searchTerms.map(t => [t, replacement]));
        let total = 0;
        for (let iter = 0; iter < ITERATIONS; iter++) {
            const start = performance.now();
            renameMap(content, new Map(refs), [replacement]);
            const end = performance.now();
            total += end - start;
        }
        const avg = total / ITERATIONS;
        results.set(`renameMap single file 1x${LINES_PER_FILE}`, avg);
    });

    it(`should rename single file via rename with 3 search terms (${ITERATIONS} iterations)`, () => {
        const content = generateFileContent(searchTerms, replacement, LINES_PER_FILE);
        let total = 0;
        for (let iter = 0; iter < ITERATIONS; iter++) {
            const start = performance.now();
            for (const term of searchTerms) {
                rename(content, [term], replacement);
            }
            const end = performance.now();
            total += end - start;
        }
        const avg = total / ITERATIONS;
        results.set(`rename 3 calls single file`, avg);
    });

    after(() => {
        console.log("\n========================================");
        console.log("  Renaming Performance Results");
        console.log("========================================");
        results.forEach((value, key) => {
            console.log(`  ${key}: ${value.toFixed(2)}ms`);
        });
        console.log("========================================\n");
    });
});
