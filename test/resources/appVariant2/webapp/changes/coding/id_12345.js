sap.ui.define([
    // the path for Worklist will be renamed
    'sap/ui/core/mvc/ControllerExtension', 'com/sap/base/app/id/controller/Worklist.controller', 'sap/m/MessageToast'
],
    function (
        ControllerExtension, Worklist, MessageToast
    ) {
        "use strict";
        // the path for Worklist will be renamed appVariant2
        return ControllerExtension.extend("com.sap.base.app.id.controller.Worklist.controller", {});
    });