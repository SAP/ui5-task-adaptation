/*!
 * OpenUI5
 * (c) Copyright 2009-2020 SAP SE or an SAP affiliate company.
 * Licensed under the Apache License, Version 2.0 - see LICENSE.txt.
 */

sap.ui.define([
	"sap/ui/fl/Change"
], function (
	Change
) {
	var FlexObjectFactory = function () {
	};

	FlexObjectFactory.createFromFileContent = function (oFileContent) {
		return new Change(oFileContent);
	}

	return FlexObjectFactory;
}, true);