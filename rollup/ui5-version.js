//@ts-check
const fs = require("fs");
const request = require("request");
const yaml = require("js-yaml");

module.exports = async ({ uri, projectPath }) => {
    return {
        name: "ui5-version",
        buildStart: async () => {
            const latestVersion = await getLatestVersion(uri);
            updateVersion(projectPath, latestVersion);
        }
    }
}

async function getLatestVersion(uri) {
    const options = {
        headers: {
            "Content-Type": "application/json"
        }
    };
    const versionJsonPromise = new Promise((resolve, reject) => {
        request.get(uri, options, (err, _, body) => {
            if (err) {
                reject(err);
            }
            resolve(JSON.parse(body));
        });
    });
    const versionJson = await versionJsonPromise;
    return versionJson.routes[0].target.version;
}

function updateVersion(projectPath, latestVersion) {
    const projectConfigContent = fs.readFileSync(projectPath, { encoding: "utf-8" });
    const projectConfig = yaml.load(projectConfigContent);
    projectConfig["framework"].version = latestVersion;
    const result = yaml.dump(projectConfig);
    fs.writeFileSync(projectPath, result);
}