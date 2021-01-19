/*!
 * OpenUI5
 * (c) Copyright 2009-2020 SAP SE or an SAP affiliate company.
 * Licensed under the Apache License, Version 2.0 - see LICENSE.txt.
 */

sap.ui.define([

], function (

) {
	"use strict";

	/**
	 * Flexibility change class. Stores change content and related information.
	 *
	 * @param {object} oFile - File content and admin data
	 *
	 * @class sap.ui.fl.Change
	 * @private
	 * @ui5-restricted
	 * @experimental Since 1.25.0
	 */
	var Change = function (oFile) {
		this._oDefinition = oFile;
	};

	/**
	 * Returns the change type.
	 *
	 * @returns {String} Change type of the file, for example <code>LabelChange</code>
	 * @public
	 */
	Change.prototype.getChangeType = function () {
		if (this._oDefinition) {
			return this._oDefinition.changeType;
		}
	};

	/**
	 * Returns the content section of the change.
	 * @returns {string} Content of the change file. The content structure can be any JSON.
	 *
	 * @public
	 */
	Change.prototype.getContent = function () {
		return this._oDefinition.content;
	};

	/**
	 * Returns all texts.
	 *
	 * @returns {object} All texts
	 *
	 * @function
	 */
	Change.prototype.getTexts = function () {
		return this._oDefinition.texts;
	};

	return Change;
}, true);