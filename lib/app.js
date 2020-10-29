//@ts-check
const Resource = require("@ui5/fs/lib/Resource"); // eslint-disable-line no-unused-vars
const path = require("path");
const logger = require("@ui5/logger");
const log = logger.getLogger("App");

class App {

	constructor(resources, manifestFilename) {
		this.id = null;
		this.manifestJson = null;
		this.reference = null;
		/**
		 * @type {Resource[]}
		 */
		this.properties = [];
		if (resources) {
			for (const resource of resources) {
				try {
					const basename = path.basename(resource.getPath());
					const extension = path.extname(resource.getPath());
					if (basename === manifestFilename) {
						this.manifest = resource;
					} else if (extension === ".properties") {
						this.properties.push(resource);
					}
				} catch (e) {
					log.error(`App.constructor: ${e}`)
				}
			}
		}
	}


	/**
	 * Creates app object out of resources
	 *
	 * @returns {Promise<App>} App object
	 * @memberof App
	 * @param {Resource[]} resources appVariant or baseApp resources
	 * @param {string} manifestFilename name of the manifest file with extension
	 * @param {string} [id] id of the manifest either appVariant or base app
	 */
	static async from(resources, manifestFilename, id) {
		const app = new App(resources, manifestFilename);
		if (app.manifest) {
			const content = await app.manifest.getBuffer();
			app.manifestJson = JSON.parse(content);
			app.id = id || app.manifestJson["id"];
			app.reference = app.manifestJson["reference"];
		}
		return app;
	}


	/**
	 * Update manifest filesystem resource
	 *
	 * @returns {Resource} manifest resource
	 * @memberof App
	 */
	manifestToResource() {
		this.manifest.setString(JSON.stringify(this.manifestJson));
		return this.manifest;
	}
}

module.exports = App;