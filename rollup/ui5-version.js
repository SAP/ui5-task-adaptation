//@ts-check
const fs = require("fs");
const fetch = require("node-fetch");
const yaml = require("js-yaml");

module.exports = ({ uri, projectPath }) => {
    return {
        name: "ui5-version",
        options: async (options) => {
            const latestVersion = await getLatestVersion(uri);
            updateVersion(projectPath, latestVersion);
            return options;
        }
    }
}

async function getLatestVersion(uri) {
    //@ts-ignore
    const versionJson = await fetch(uri).then(res => res.json());
    return versionJson.routes[0].target.version;
}

function updateVersion(projectPath, latestVersion) {
    const projectConfigContent = fs.readFileSync(projectPath, { encoding: "utf-8" });
    const projectConfig = yaml.load(projectConfigContent);
    projectConfig["framework"].version = latestVersion;
    const result = yaml.dump(projectConfig);
    fs.writeFileSync(projectPath, result);
}