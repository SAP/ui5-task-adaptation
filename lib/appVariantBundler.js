// @ts-check
const path = require("path");
const logger = require("@ui5/logger");
const log = logger.getLogger("AppVariantBundler");
const resourceFactory = require("@ui5/fs/lib/resourceFactory");
const AdmZip = require("adm-zip");
const Resource = require("@ui5/fs/lib/Resource"); // eslint-disable-line no-unused-vars
const { crc32 } = require("crc");
const CFUtil = require("./cfUtil");
const BuildStrategy = require("./buildStrategy");
const App = require("./app");
const { RegistrationBuild, ApplyUtil, Applier, Change } = require("../dist/bundle");


/**
 * Creates an appVariant bundle from the provided resources.
 *
 * @alias @ui5/builder.processors.appVariantBundler
 * @public
 * @param {object} parameters Parameters
 * @param {Resource[]} parameters.resources List of resources to be processed
 * @param {CFUtil} [parameters.cfUtil] List of base app resources
 * @param {CFUtil} [parameters.taskUtil] Utility to omit unused files
 * @param {object} parameters.options Options
 * @param {string} parameters.options.projectNamespace Namespace
 * @param {object} parameters.options.configuration appHostId, appName and appVersion to download base app
 * @param {object} parameters.workspace filesystem
 * @returns {Promise<Resource[]>} Promise resolving with appVariant bundle resources
 */
module.exports = ({ workspace, options, taskUtil, cfUtil }) => {
	const MANIFEST_APP_VARIANT = "manifest.appdescr_variant";
	const MANIFEST_BASE_APP = "manifest.json";
	const EXTENSIONS = "js,json,xml,html,properties,change,appdescr_variant";

	/**
	 * Main entry point to process app variant
	 *
	 * @param {object} workspace
	 * @param {CFUtil} [cfUtil] base application resources if already exist
	 * @returns {Promise<Resource[]>} processed resources
	 */
	async function process(workspace, taskUtil, cfUtil = new CFUtil()) {
		const appVariantResources = await workspace.byGlob(`/**/*.{${EXTENSIONS}}`);
		omitFiles(appVariantResources, taskUtil);
		if (!appVariantResources || appVariantResources.length === 0) {
			log.error("No appVariant resources found");
			return [];
		}
		if (!options || !options.configuration) {
			throw new Error("Missing parameters: appHostId, appName, appVersion");
		}
		const [appVariant, appResources] = await Promise.all([
			App.from(appVariantResources, MANIFEST_APP_VARIANT),
			downloadBaseApp(options.configuration, cfUtil)
		]);
		const module = createModuleName(options, appVariant.id);
		const [baseApp] = await Promise.all([
			renameBaseApp(appResources, appVariant.reference, appVariant.id),
			writeI18nToModule(appVariant, module)
		]);
		if (baseApp != null) {
			removeSapCloudProperty(baseApp);
			fillAppVariantIdHierarchy(baseApp);
			adjustAddNewModelEnhanceWith(appVariant, module);
			await applyDescriptorChanges(baseApp, appVariant, module);
			await workspace.write(baseApp.manifestToResource());
		}
	}

	return process(workspace, taskUtil, cfUtil);

	/**
	 * Exclude files from writing to destination folder
	 * @param  {Resource[]} appVariantResources resources of app variant
	 * @param  {any} taskUtil utility to set omit flag to resources
	 */
	function omitFiles(appVariantResources, taskUtil) {
		const IGNORE_OMIT_FILES = ["manifest.json"];
		const IGNORE_OMIT_FOLDERS = ["changes/fragments"];
		if (taskUtil) {
			const flag = taskUtil.STANDARD_TAGS.OmitFromBuildResult;
			appVariantResources.forEach((resource) => {
				const dirname = path.dirname(resource.getPath());
				const filename = path.basename(resource.getPath());
				if (!IGNORE_OMIT_FILES.includes(filename) &&
					!IGNORE_OMIT_FOLDERS.every(folder => dirname.endsWith(folder))) {
					taskUtil.setTag(resource, flag, true);
				}
			});
		} else {
			log.warn("No taskUtil found, omitting files is skipped");
		}
	}


	function createModuleName(options, appVariantId) {
		return options && options.configuration && options.configuration.module ||
			"appvariant-" + crc32(appVariantId).toString(16);
	}


	/**
	 * Delete sap.cloud property from manifest.json
	 *
	 * @param {App} baseApp base application
	 */
	function removeSapCloudProperty(baseApp) {
		log.info("Removing sap.cloud from manifest");
		delete baseApp.manifestJson["sap.cloud"];
	}


	/**
	 * Fill up sap.ui5/appVariantIdHierarchy
	 *
	 * @param {App} baseApp base application
	 */
	function fillAppVariantIdHierarchy(baseApp) {
		log.info("Filling up app variant hierarchy in manifest.json");
		const version = baseApp.manifestJson["sap.app"]["applicationVersion"]["version"];
		baseApp.manifestJson["sap.ui5"]["appVariantIdHierarchy"] = [{
			appVariantId: baseApp.id,
			version
		}];
	}


	/**
	 * Change property files path to save it later by this path to file system
	 *
	 * @param {App} appVariant app variant
	 * @param {string} module app variant
	 * "customer.sap.ui.rta.test.variantManagement.business.service.variantbundle.i18n.i18n"
	 */
	async function writeI18nToModule(appVariant, module) {
		log.info(`Writing ${appVariant.properties.length} appVariant i18n properties to module '${module}'`);
		await Promise.all(appVariant.properties.map(async (property) => {
			const newPath = ["/resources"];
			if (options && options.projectNamespace) {
				newPath.push(options.projectNamespace);
			}
			const rootFolder = newPath.join("/");
			newPath.push(module);
			newPath.push(property.getPath().substring(rootFolder.length));
			property.setPath(path.resolve(newPath.join("/")));
			await workspace.write(property);
		}));
	}


	/**
	 * Adjusts appdescr_ui5_addNewModelEnhanceWith changes with module name prefix
	 *
	 * @param {App} appVariant app variant
	 * @param {string} module module name
	 */
	function adjustAddNewModelEnhanceWith(appVariant, module) {
		log.info("Adjusting appdescr_ui5_addNewModelEnhanceWith with module");
		if (appVariant.manifestJson.content) {
			appVariant.manifestJson.content.forEach((change) => {
				if (change.changeType === "appdescr_ui5_addNewModelEnhanceWith") {
					if (!change.texts) {
						change.texts = { i18n: "i18n/i18n.properties" };
					}
					change.texts.i18n = module + "/" + change.texts.i18n;
				}
			});
		}
	}


	/**
	 * Rename base app resources from it original id to app variant id
	 *
	 * @param {Resource[]} baseAppResources resources of base application
	 * @param {string} search search this word
	 * @param {string} replacement and replace with this
	 * @returns {Promise<App>} renamed base application
	 */
	async function renameBaseApp(baseAppResources, search, replacement) {
		log.info("Renaming base app resources to appVariant id");
		if (baseAppResources.length === 0 || search == null || replacement == null) {
			return Promise.resolve(null);
		}
		const dotToSlash = (update) => update.split(".").join("\/"); // eslint-disable-line no-useless-escape
		const dotsEscape = (update) => update.split(".").join("\\.");
		const replaces = [
			{
				regexp: new RegExp(dotsEscape(search), "g"),
				replacement
			},
			{
				regexp: new RegExp(dotToSlash(search), "g"),
				replacement: dotToSlash(replacement)
			}
		];
		let baseAppId = "";
		await Promise.all(baseAppResources.map((resource) =>
			resource.getBuffer().then((content) => {
				try {
					if (resource.getPath().endsWith(MANIFEST_BASE_APP)) {
						// @ts-ignore
						baseAppId = JSON.parse(content)["sap.app"]["id"];
					}
					const original = content.toString("utf8");
					const string = replaces.reduce((p, c) => p.replace(c.regexp, c.replacement), original);
					resource.setString(string);
					return resource;
				} catch (e) {
					log.error(`renameBaseApp: ${e}`)
				}
			})
		));
		return App.from(baseAppResources, MANIFEST_BASE_APP, baseAppId);
	}


	/**
	 * Download base application from HTML5 repository
	 * @param {object} parameters parameters from BAS generator
	 * @param {string} parameters.appHostId appHostId to get base app from
	 * @param {string} parameters.appName base app name
	 * @param {string} parameters.appVersion base app version
	 * @param {CFUtil} cfUtil cloud foundry utility service
	 * @returns {Promise<Resource[]>} base app saved resources
	 */
	async function downloadBaseApp(parameters, cfUtil) {
		if (parameters == null) {
			throw new Error("No appHostId, appName and appVersion provided to fetch base app");
		}
		log.info("Fetching base app resources from HTML5 Repo");
		const spaceField = await cfUtil.getSpace();
		if (!spaceField) {
			throw new Error("Space is not available in cf config");
		}
		const htmlRepoCredentials = await cfUtil.getHtml5RepoCredentials(spaceField.GUID, cfUtil);
		const token = await cfUtil.getToken(htmlRepoCredentials);
		const { appHostId, appName, appVersion } = parameters;
		const appNameVersion = `${appName}-${appVersion}`;
		const uri = `${htmlRepoCredentials.uri}/applications/content/${appNameVersion}/`;
		const zip = await cfUtil.downloadZip(token, appHostId, uri);
		let admZip;
		try {
			admZip = new AdmZip(zip);
		} catch (error) {
			console.log("Failed to parse zip content from HTML5 repo", error);
		}
		if (typeof admZip === "undefined") {
			Promise.reject("Failed to parse zip content from HTML5 repo");
		}
		return writeToWorkspace(admZip.getEntries());
	}


	/**
	 * Write base app files to workspace
	 * @param {AdmZip.IZipEntry[]} zipEntries
	 * @returns {Promise<Resource[]>} base app saved resources
	 */
	async function writeToWorkspace(zipEntries) {
		const ignoreFiles = [
			"/manifest-bundle.zip",
			"/Component-preload.js",
			"/sap-ui-cachebuster-info.json"
		];
		const getPath = (item) => {
			const paths = ["/resources"];
			if (options.projectNamespace) {
				paths.push(options.projectNamespace);
			}
			paths.push(item.entryName);
			return path.resolve("/" + paths.join("/"));
		};
		const filtered = zipEntries.filter((item) => {
			const filepath = getPath(item);
			return !ignoreFiles.includes(item.entryName) && path.extname(filepath) != "";
		});
		return Promise.all(filtered.map(async (item) => {
			const string = item.getData().toString("utf8");
			const resource = resourceFactory.createResource({ path: getPath(item), string });
			await workspace.write(resource);
			return resource;
		}));
	}


	/**
	 * @param {App} baseApp
	 * @param {App} appVariant
	 * @param {string} module
	 */
	async function applyDescriptorChanges(baseApp, appVariant, module) {
		log.info("Applying appVariant changes");
		if (!appVariant.manifestJson.content) {
			return Promise.resolve();
		}
		const strategy = new BuildStrategy(RegistrationBuild, ApplyUtil, module);
		const changes = appVariant.manifestJson.content.map((content) => new Change(content));
		return Applier.applyChanges(baseApp.manifestJson, changes, strategy);
	}
};