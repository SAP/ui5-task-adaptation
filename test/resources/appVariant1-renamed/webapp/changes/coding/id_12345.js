sap.ui.define([
    // the path for Worklist will be renamed
    'sap/ui/core/mvc/ControllerExtension', 'customer/com/sap/application/variant/id/controller/Worklist.controller', 'sap/m/MessageToast'
],
function (
    ControllerExtension, Worklist, MessageToast
) {
    "use strict";
    // the path for Worklist will be renamed appVariant1
    return ControllerExtension.extend("customer.com.sap.application.variant.id.Worklist.controller", {});
});