import { getLogger } from "@ui5/logger";
import IProcessor from "./processors/processor.js";
import { IReuseLibInfo } from "./model/types.js";
import ResourceUtil from "./util/resourceUtil.js";
import path from "path";
import { merge, Route, XsApp } from "./util/cf/xsAppJsonUtil.js";

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


const log = getLogger("@ui5/task-adaptation::PreviewManager");
const REUSE_DIR = ".adp/reuse";
const APP_INFO_FILE = "ui5AppInfo.json";
const XS_APP_JSON_FILE = "xs-app.json";

export default class PreviewManager {

	private readonly fetchLibsPromises: Map<string, Promise<ReadonlyMap<string, string>>> = new Map();

	static async createFromRoot(appId: string, processor: IProcessor): Promise<PreviewManager> {
		let ui5AppInfo: string = "";

		if (PreviewManager.isPreviewRequested()) {
			try {
				ui5AppInfo = await ResourceUtil.readInProject(APP_INFO_FILE);
			} catch (_err) {
				log.verbose("Preview mode not requested (env variable ADP_BUILDER_MODE=preview is not set), skipping preview resources processing.");
				throw new Error(`ui5AppInfo.json is missing in project root, cannot process preview resources.`);
			}
		}

		return new PreviewManager(appId, ui5AppInfo, processor);
	}

	static isPreviewRequested(): boolean {
		return process.env.ADP_BUILDER_MODE === "preview";
	}

	private constructor(appId: string, ui5AppInfo: string, processor: IProcessor) {
		// If no ui5AppInfo is provided, no preview processing is needed
		if (!ui5AppInfo) {
			return;
		}

		const appInfo: AppInfo = JSON.parse(ui5AppInfo)[appId];
		if (!appInfo) {
			throw new Error(`No app info found for original app id '${appId}' in ui5AppInfo.json`);
		}

		const reuseLibs = appInfo.asyncHints.libs.filter(lib => lib.html5AppHostId && lib.html5AppName && lib.html5AppVersion);
		if (reuseLibs.length > 0) {
			this.fetchLibsPromises = this.preReadLibs(reuseLibs, processor);
		}

		const logMap: { [key: string]: any } = {
			Error: log.error,
			Warning: log.warning,
			Info: log.info,
			debug: log.verbose
		};

		appInfo.messages.forEach((message) => {
			const logger = logMap[message.severity] || log.info;
			logger(`ui5AppInfo.json: ${message.severity} Message: ${message.message} (Error Code: ${message.errorCode})`);
		});
	}

	async processPreviewResources(baseAppFiles: ReadonlyMap<string, string>): Promise<void> {
		log.verbose(`Downloading reuse libraries to reuse folder`);
		const xsAppFiles: Map<string, string> = new Map();
		if (this.fetchLibsPromises.size === 0) {
			log.verbose("No reuse libraries defined in ui5AppInfo.json for preview");
			return;
		}

		const mergedFiles = new Map<string, string>();
		for (const [libName, libFilesPromise] of this.fetchLibsPromises) {
			const libFiles = await libFilesPromise;
			if (!libFiles || libFiles.size === 0) {
				log.warn(`No files found in reuse library ${libName} for preview`);
				continue;
			}
			for (const [filename, content] of libFiles) {
				mergedFiles.set(filename, content);
				if (filename.includes(XS_APP_JSON_FILE)) {
					xsAppFiles.set(filename, content);
				}
			}
		}

		this.searchBaseAppXsAppJsonFile(xsAppFiles, baseAppFiles);
		this.mergeXsAppJsonFiles(xsAppFiles, mergedFiles);
		await ResourceUtil.writeInProject(REUSE_DIR, mergedFiles);
	}

	private preReadLibs(reuseLibs: IReuseLibInfo[], processor: IProcessor): Map<string, Promise<ReadonlyMap<string, string>>> {
		const promises = new Map<string, Promise<ReadonlyMap<string, string>>>();
		reuseLibs.forEach(lib => {
			log.info(`Downloading reuse library '${lib.html5AppName}' version '${lib.html5AppVersion}'`);
			const promise = processor
				.fetchReuseLib(lib.html5AppName, lib.html5CacheBusterToken, lib)
				.then(libFiles => PreviewManager.moveLibraryFiles(libFiles, lib.html5AppName, lib.name));
			promises.set(lib.html5AppName, promise);
		});
		return promises;
	}

	private searchBaseAppXsAppJsonFile(xsAppFiles: Map<string, string>, baseAppFiles: ReadonlyMap<string, string>): void {
		const xsAppJsonContent = baseAppFiles.get(XS_APP_JSON_FILE);
		if (xsAppJsonContent) {
			xsAppFiles.set(XS_APP_JSON_FILE, xsAppJsonContent);
		} else {
			log.warn("xs-app.json is missing in the downloaded base app files for preview");
		}
	}

	private mergeXsAppJsonFiles(xsAppFiles: Map<string, string>, files: Map<string, string>): void {
		const mergedXsAppJson = merge([...xsAppFiles.values()]);
		if (mergedXsAppJson) {
			files.set(XS_APP_JSON_FILE, mergedXsAppJson);
		}
	}

	private static moveLibraryFiles(inputFiles: ReadonlyMap<string, string>, libraryName: string, libId: string): ReadonlyMap<string, string> {
		const files = new Map<string, string>();
		inputFiles.forEach((content: string, filename: string) => {
			const newFilename = path.join(libraryName, filename);

			// Source path in xs-app.json needs to be adjusted to new location
			if (filename.includes(XS_APP_JSON_FILE)) {
				content = PreviewManager.modifyRoutes(content, libraryName, libId);
			}

			files.set(newFilename, content);
		});
		return files;
	};

	private static modifyRoutes(xsAppJson: string, libName: string, libId: string): string {
		const xsApp: XsApp = JSON.parse(xsAppJson);
		xsApp.routes = xsApp.routes.map((route: Route) => {
			route.source = route.source.replace(new RegExp("^\\^\\/?(resources/)?"), `^/resources/${libId.replaceAll(".", "/")}/`);
			if (route.service === "html5-apps-repo-rt") {
				route = {
					source: route.source,
					target: route.target,
					localDir: path.join(REUSE_DIR, libName)
				}
			}
			return route;
		});
		return JSON.stringify(xsApp);
	}
}
