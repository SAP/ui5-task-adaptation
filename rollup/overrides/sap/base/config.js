/*!
* ${copyright}
*/
sap.ui.define([
], (
) => {
    "use strict";

    /**
     * The base Configuration.
     *
     * @author SAP SE
     * @version ${version}
     * @private
     * @ui5-restricted sap.ui.core, sap.fl, sap.ui.intergration, sap.ui.export
     * @alias module:sap/base/config
     * @borrows module:sap/base/config/_Configuration.get as get
     * @borrows module:sap/base/config/_Configuration.Type as Type
     * @namespace
     */

    const _Configuration = { _: {} };

    const internalConfig = new Map();

    /**
     * Returns a writable base configuration instance
     * @returns {module:sap/base/config} The writable base configuration
     * @private
     * @ui5-restricted sap.ui.core, sap.fl
     */
    _Configuration.getWritableInstance = () => {
        return {
            get(obj) {
                internalConfig.get(obj.name);
            },
            set(name, obj) {
                internalConfig.set(name, obj);
            }
        }
    };

    /**
     * Attaches the <code>fnFunction</code> event handler to the {@link #event:invalidated invalidated} event
     *
     * @param {function} fnFunction The function to be called when the event occurs
     * @private
     */
    function attachInvalidated() {
    }
    _Configuration._.attachInvalidated = attachInvalidated;

    const origInvalidate = _Configuration._.invalidate;
    _Configuration._.invalidate = () => {
        origInvalidate();
    };

    return _Configuration;
});