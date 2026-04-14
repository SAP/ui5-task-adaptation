import { promises as fs } from "fs";
import path from "path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { Octokit } from "@octokit/rest";
import { retry } from "@octokit/plugin-retry";

const OctokitClass = Octokit.plugin(retry);


/**
 * Recursively get all file paths in the workspace root, excluding:
 *   - test/lib/integration
 *   - test/fixtures
 *   - test/expected
 *   - test/lib/index.perf.ts
 * Returns relative paths from the root.
 */
async function getAllRootFilesExceptTestExclusions(root: string): Promise<string[]> {
    const excludeDirs = [
        "test/lib/integration",
        "test/fixtures",
        "test/expected",
        ".git",
        "coverage",
        ".DS_Store",
        "node_modules",
        ".nyc_output",
        "coverage",
        "dist",
        "dist-debug",
        "dist.zip",
        ".env",
        "test/resources/metadata/download"
    ];
    const excludeFiles = [
        "test/lib/index.perf.ts",
        "scripts/test-integration-prep.sh",
        "Jenkinsfile"
    ];

    async function walk(dir: string): Promise<string[]> {
        const dirents = await fs.readdir(dir, { withFileTypes: true });
        const files: string[] = [];
        for (const dirent of dirents) {
            const relPath = path.relative(root, path.join(dir, dirent.name));
            if (excludeDirs.some(ex => relPath === ex || relPath.startsWith(ex + path.sep))) {
                continue;
            }
            if (excludeFiles.includes(relPath)) {
                continue;
            }
            if (dirent.isDirectory()) {
                files.push(...await walk(path.join(dir, dirent.name)));
            } else {
                files.push(relPath);
            }
        }
        return files;
    }
    return walk(root);
}

const FILES = await getAllRootFilesExceptTestExclusions(process.cwd());


interface PublishArgs {
    p?: string;
    dryRun?: boolean;
    tag?: string;
    branch?: string;
    [key: string]: unknown;
}

async function publish() {
    const argv = yargs(hideBin(process.argv))
        .option("p", {
            type: "string",
            description: "GitHub token (-p)",
            alias: "p"
        })
        .option("dryRun", {
            type: "boolean",
            description: "Run without publishing",
            default: false
        })
        .option("tag", {
            type: "string",
            description: "Publish with a specific tag"
        })
        .option("branch", {
            type: "string",
            description: "Branch to update (default: main)",
            default: "main",
            alias: "b"
        })
        .help()
        .alias("h", "help")
        .parseSync() as PublishArgs;

    if (argv.dryRun) {
        console.log("Dry run: no publishing will be performed.");
        return;
    }
    const auth = argv.p;
    if (auth) {
        const octokit = new OctokitClass({ auth });
        const ORGANIZATION = "SAP";
        const REPO = "ui5-task-adaptation";
        await uploadToRepo(octokit, ORGANIZATION, REPO, argv.branch);
        if (argv.tag) {
            console.log(`Published with tag: ${argv.tag}`);
        }
    } else {
        console.log("Github token is not provided.");
    }
}


async function getLatestVersion(): Promise<string> {
    const pkg = await fs.readFile(path.join(process.cwd(), "package.json"), { encoding: "utf-8" });
    const pkgJson = JSON.parse(pkg);
    return pkgJson.version;
}


async function uploadToRepo(
    octokit: InstanceType<typeof OctokitClass>,
    org: string,
    repo: string,
    branch: string = "main"
): Promise<void> {
    const fileBlobs = await Promise.all(Object.values(FILES).map(file => toBlob(octokit, org, repo, path.join(process.cwd(), file))));
    const currentCommit = await getCurrentCommit(octokit, org, repo, branch);
    const newTree = await createNewTree(
        octokit,
        org,
        repo,
        fileBlobs,
        FILES,
        currentCommit.treeSha
    );
    const currentVersion = await getLatestVersion();
    const commitMessage = `Release ${currentVersion}`;
    const newCommit = await createNewCommit(
        octokit,
        org,
        repo,
        commitMessage,
        newTree.sha,
        currentCommit.commitSha
    );
    await setBranchToCommit(octokit, org, repo, branch, newCommit.sha);
}


async function getCurrentCommit(
    octokit: InstanceType<typeof OctokitClass>,
    org: string,
    repo: string,
    branch: string = "main"
): Promise<{ commitSha: string; treeSha: string }> {
    const { data: refData } = await octokit.git.getRef({
        owner: org,
        repo,
        ref: `heads/${branch}`,
    });
    const commitSha = refData.object.sha
    const { data: commitData } = await octokit.git.getCommit({
        owner: org,
        repo,
        commit_sha: commitSha,
    });
    return {
        commitSha,
        treeSha: commitData.tree.sha,
    }
}


async function toBlob(
    octokit: InstanceType<typeof OctokitClass>,
    org: string,
    repo: string,
    filePath: string
): Promise<{ sha: string }> {
    const content = await fs.readFile(filePath, { encoding: "utf8" });
    const blobData = await octokit.git.createBlob({
        owner: org,
        repo,
        content,
        encoding: "utf-8",
    })
    return blobData.data;
}


async function createNewTree(
    octokit: InstanceType<typeof OctokitClass>,
    owner: string,
    repo: string,
    blobs: { sha: string }[],
    paths: string[],
    parentTreeSha: string
): Promise<any> {
    const tree = blobs.map(({ sha }, i) => ({
        path: paths[i],
        mode: "100644" as const,
        type: "blob" as const,
        sha,
    }));
    const { data } = await octokit.git.createTree({
        owner,
        repo,
        tree,
        base_tree: parentTreeSha,
    })
    return data;
}


async function createNewCommit(
    octokit: InstanceType<typeof OctokitClass>,
    org: string,
    repo: string,
    message: string,
    currentTreeSha: string,
    currentCommitSha: string
): Promise<any> {
    const commit = await octokit.git.createCommit({
        owner: org,
        repo,
        message,
        tree: currentTreeSha,
        parents: [currentCommitSha],
    });
    return commit.data;
};


async function setBranchToCommit(
    octokit: InstanceType<typeof OctokitClass>,
    org: string,
    repo: string,
    branch: string = "main",
    commitSha: string
): Promise<any> {
    return octokit.git.updateRef({
        owner: org,
        repo,
        ref: `heads/${branch}`,
        sha: commitSha,
    });
}

publish();
