import { expect } from "chai";
import OmitDeletedResourcesCommand from "../../../../src/adapters/commands/omitDeletedResourcesCommand.js";
import AppVariant from "../../../../src/appVariant.js";

const NS = "ns";

function fakeResource(rootRelativePath: string) {
    let buffer: Buffer | undefined;
    return {
        getPath: () => `/resources/${NS}/${rootRelativePath}`,
        setBuffer: (b: Buffer) => { buffer = b; },
        getBuffer: () => buffer,
    };
}

function fakeTaskUtil() {
    const tags = new Map<string, boolean>();
    return {
        STANDARD_TAGS: { OmitFromBuildResult: "OmitFromBuildResult" },
        setTag: (resource: any, _tag: string, value: boolean) => tags.set(resource.getPath(), value),
        isOmitted: (resource: any) => tags.get(resource.getPath()) === true,
    };
}

describe("OmitDeletedResourcesCommand", () => {

    // Regression guard: when movedFiles was dead (always empty) this branch
    // never ran, so setBuffer was never called. This test fails in that state.
    it("omits a moved source resource and rewrites it to the renamed (new-path) content", async () => {
        const resource = fakeResource("changes/coding/foo.js");
        const taskUtil = fakeTaskUtil();
        const movedFiles = new Map([["changes/coding/foo.js", "changes/app_var/coding/foo.js"]]);
        // The original path is absent from the build output -> treated as moved.
        const files = new Map<string, Buffer>([
            ["changes/app_var/coding/foo.js", Buffer.from("renamed-content")]
        ]);

        await new OmitDeletedResourcesCommand(taskUtil as any, movedFiles, [resource] as any, NS).execute(files);

        expect(taskUtil.isOmitted(resource), "moved resource must be omitted from build").to.be.true;
        expect(resource.getBuffer()?.toString(), "omitted resource must carry the renamed content from movedFiles")
            .to.equal("renamed-content");
    });

    it("omits but does not rewrite when the moved file has no movedFiles mapping", async () => {
        const resource = fakeResource("changes/coding/foo.js");
        const taskUtil = fakeTaskUtil();
        const files = new Map<string, Buffer>(); // old path absent -> omitted, but no mapping

        await new OmitDeletedResourcesCommand(taskUtil as any, new Map(), [resource] as any, NS).execute(files);

        expect(taskUtil.isOmitted(resource)).to.be.true;
        expect(resource.getBuffer(), "without a mapping setBuffer must not be called").to.be.undefined;
    });

    it("leaves a resource untouched when it is still present in the build output", async () => {
        const resource = fakeResource("manifest.json");
        const taskUtil = fakeTaskUtil();
        const files = new Map<string, Buffer>([["manifest.json", Buffer.from("{}")]]); // path present

        await new OmitDeletedResourcesCommand(
            taskUtil as any, new Map([["manifest.json", "whatever"]]), [resource] as any, NS
        ).execute(files);

        expect(taskUtil.isOmitted(resource), "present resource must not be omitted").to.not.be.true;
        expect(resource.getBuffer(), "present resource must not be rewritten").to.be.undefined;
    });

    // End-to-end with the real move logic: an app variant whose sources contain
    // files that must be moved under the prefix folder (changes/, ext/). After
    // getProcessedFiles those files live at new paths, so their ORIGINAL
    // workspace resources must be omitted from the build.
    it("omits the original paths of files that AppVariant actually moves", async () => {
        const appVariant = AppVariant.fromFiles(new Map<string, Buffer>([
            ["manifest.appdescr_variant", Buffer.from(JSON.stringify({
                id: "customer.app.variant1",
                reference: "base.app",
                layer: "CUSTOMER_BASE",
                content: []
            }))],
            ["manifest.json", Buffer.from("{}")],                               // stays in place
            ["changes/fragments/Bar.fragment.xml", Buffer.from("<fragment/>")], // moved under prefix
            ["ext/controller/Baz.controller.js", Buffer.from("// controller")], // moved under prefix
        ]));

        const processedFiles = new Map(appVariant.getProcessedFiles());
        const movedFiles = appVariant.getMovedFiles();

        // sanity: the fixture really produces files that need moving
        expect(movedFiles.size, "fixture must contain files that need moving").to.equal(2);
        // ...and they are gone from their original locations in the output
        expect(processedFiles.has("changes/fragments/Bar.fragment.xml")).to.be.false;
        expect(processedFiles.has("ext/controller/Baz.controller.js")).to.be.false;

        const movedResources = [...movedFiles.keys()].map(fakeResource);
        const keptResource = fakeResource("manifest.json");
        const taskUtil = fakeTaskUtil();

        await new OmitDeletedResourcesCommand(
            taskUtil as any, movedFiles, [...movedResources, keptResource] as any, NS
        ).execute(processedFiles);

        for (const resource of movedResources) {
            expect(taskUtil.isOmitted(resource), `${resource.getPath()} must be omitted`).to.be.true;
        }
        expect(taskUtil.isOmitted(keptResource), "non-moved file must stay in the build").to.not.be.true;
    });
});
