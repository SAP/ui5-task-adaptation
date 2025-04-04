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
    var AppDescriptorChange = function (content) {
        this.content = content;
    };

    /**
     * Returns the change type.
     *
     * @returns {String} Change type of the file, for example <code>LabelChange</code>
     * @public
     */
    AppDescriptorChange.prototype.getChangeType = function () {
        return this.content?.flexObjectMetadata?.changeType || this.content?.changeType;
    };

    /**
     * Gets the layer type for the change.
     * @returns {string} Layer of the change file
     *
     * @public
     */
    AppDescriptorChange.prototype.getLayer = function () {
        return this.content.layer;
    };

    /**
     * Returns the content section of the change.
     * @returns {string} Content of the change file. The content structure can be any JSON.
     *
     * @public
     */
    AppDescriptorChange.prototype.getContent = function () {
        return this.content.content;
    };

    /**
     * Returns all texts.
     *
     * @returns {object} All texts
     *
     * @function
     */
    AppDescriptorChange.prototype.getTexts = function () {
        return this.content.texts;
    };

    return AppDescriptorChange;
}, true);
