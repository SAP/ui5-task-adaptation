import FsUtil from "../../util/fsUtil.js";
import path from "path";
import { IPromiseCommand, SetupCommand } from "./command.js";
import { FetchFilesPromise, IReuseLibInfo } from "../../model/types.js";
import { Route, XsApp } from "../../util/cf/xsAppJsonUtil.js";
import { getLogger } from "@ui5/logger";
import { REUSE_DIR } from "../../model/configuration.js";
import { IHtml5Resource } from "../../repositories/html5Repository.js";
import IRepository from "../../repositories/repository.js";
const log = getLogger("@ui5/task-adaptation::FetchPreviewResourcesCommand");


type AppInfoMessage = {
    message: string;
    severity: string;
    errorCode: string;
};

type AppInfo = {
    asyncHints: {
        libs: IReuseLibInfo[];
    };
    name: string;
    version: string;
    messages: AppInfoMessage[];
};


export default class FetchPreviewResourcesCommand extends SetupCommand implements IPromiseCommand<FetchFilesPromise | undefined> {
    result: Promise<FetchFilesPromise | undefined> = Promise.resolve(undefined);

    constructor(private appId: string, private repository: IRepository) {
        super();
    }

    async execute(): Promise<void> {
        this.result = this.preparePreview();
    }

    private async preparePreview(): Promise<FetchFilesPromise> {
        let ui5AppInfo: string = "";
        try {
            ui5AppInfo = await FsUtil.readInProject("ui5AppInfo.json", "utf-8") as string;
        } catch (error) {
            throw new Error(`ui5AppInfo.json is missing in project root, cannot process preview resources: ${error instanceof Error ? error.message : String(error)}`);
        }
        // If no ui5AppInfo is provided, no preview processing is needed
        if (!ui5AppInfo) {
            log.verbose("No ui5AppInfo provided, skipping preview resources processing.");
            return new Map();
        }

        const appInfo: AppInfo = JSON.parse(ui5AppInfo)[this.appId];
        if (!appInfo) {
            throw new Error(`No app info found for original app id '${this.appId}' in ui5AppInfo.json`);
        }

        this.printMessages(appInfo.messages);

        const reuseLibs = appInfo.asyncHints.libs.filter(lib => lib.html5AppHostId && lib.html5AppName && lib.html5AppVersion);
        if (reuseLibs.length > 0) {
            return this.preReadLibs(reuseLibs, this.repository);
        }
        log.verbose("No reuse libraries defined in ui5AppInfo.json for preview");
        return new Map();
    }

    private printMessages(appInfoMessages: AppInfoMessage[]) {
        const logMap: { [key: string]: any } = {
            Error: log.error,
            Warning: log.warning,
            Info: log.info,
            debug: log.verbose
        };

        appInfoMessages.forEach((message) => {
            const logger = logMap[message.severity] || log.info;
            logger(`ui5AppInfo.json: ${message.severity} Message: ${message.message} (Error Code: ${message.errorCode})`);
        });
    }

    private preReadLibs(reuseLibs: IReuseLibInfo[], repository: IRepository): Map<string, Promise<ReadonlyMap<string, string>>> {
        const promises = new Map<string, Promise<ReadonlyMap<string, string>>>();
        reuseLibs.forEach(lib => {
            log.info(`Downloading reuse library '${lib.html5AppName}' version '${lib.html5AppVersion}'`);
            const resource: IHtml5Resource = {
                appName: lib.html5AppName,
                appVersion: lib.html5AppVersion,
                appHostId: lib.html5AppHostId,
                cacheBusterToken: Promise.resolve(lib.html5CacheBusterToken)
            }
            const promise = repository
                .fetch(resource)
                .then((libFiles: ReadonlyMap<string, string>) => this.moveLibraryFiles(libFiles, lib.html5AppName, lib.name));
            promises.set(lib.html5AppName, promise);
        });
        return promises;
    }

    private moveLibraryFiles(inputFiles: ReadonlyMap<string, string>, libraryName: string, libId: string): ReadonlyMap<string, string> {
        const files = new Map<string, string>();
        inputFiles.forEach((content: string, filename: string) => {
            const newFilename = path.join(libraryName, filename);

            // Source path in xs-app.json needs to be adjusted to new location
            if (filename.includes("xs-app.json")) {
                content = this.modifyRoutes(content, libraryName, libId);
            }

            files.set(newFilename, content);
        });
        return files;
    };

    private modifyRoutes(xsAppJson: string, libName: string, libId: string): string {
        const xsApp: XsApp = JSON.parse(xsAppJson);
        xsApp.routes = xsApp.routes.map((route: Route) => {
            route.source = route.source.replace(new RegExp("^\\^\\/?(resources/)?"), `^/resources/${libId.replaceAll(".", "/")}/`);
            if (route.service === "html5-apps-repo-rt") {
                route = {
                    source: route.source,
                    target: route.target,
                    localDir: [REUSE_DIR, libName].join("/")
                }
            }
            return route;
        });
        return JSON.stringify(xsApp);
    }
}
