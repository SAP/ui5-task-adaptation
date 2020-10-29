class Change {
	constructor(oFile) {
		this._oDefinition = oFile;
	}

	getContent() {
		return this._oDefinition.content;
	}

	getChangeType() {
		if (this._oDefinition) {
			return this._oDefinition.changeType;
		}
	}

	getTexts() {
		if (this._oDefinition) {
			return this._oDefinition.texts;
		}
	}
}

if (typeof sap === "object") {
	sap.ui.define([], () => Change, true); // eslint-disable-line no-undef
}

if (typeof module === "object" && module.exports) {
	module.exports = Change;
}
