sap.ui.define(
    [
        "com/sap/base/app/id/ext/util/Dialogs",
        "com/sap/base/app/id/ext/util/TemplateFilters",
        "com/sap/base/app/id/ext/util/IntervalTrigger",
        "com/sap/base/app/id/ext/util/Api",
        "com/sap/base/app/id/ext/util/Utils",
        "sap/ui/richtexteditor/RichTextEditor",
        "sap/ui/core/ValueState",
        "sap/m/Button",
        "sap/m/ButtonType",
        "sap/m/Dialog",
        "sap/m/MessageToast",
        "sap/m/Text",
        "sap/ui/model/Filter",
        "sap/ui/model/FilterOperator",
        "sap/ui/core/message/Message",
        "sap/ui/core/MessageType",
    ],
    function (e, t, i, s, n, a, l, o, r, d, h, g, c, u, m, b) {
        "use strict";
        sap.ui.controller("com.sap.base.app.id.ext.controller.ObjectPageExt", {
            constants: Object.freeze({
                fileName: "id_1511824168527_10_propertyChange",
                fileType: "change",
                changeType: "propertyChange",
                reference: "com.sap.base.app.id.Component",
                packageName: "$TMP",
                content: {
                    property: "useExportToExcel",
                    newValue: true,
                },
                selector: {
                    id: "com.sap.base.app.id::sap.suite.ui.generic.template.ListReport.view.ListReport::BaseApp--listReport",
                    type: "sap.ui.comp.smarttable.SmartTable",
                    idIsLocal: false,
                },
                layer: "VENDOR",
                texts: {},
                namespace: "apps/com.sap.base.app.id/changes/",
                projectId: "com.sap.base.app.id",
                creation: "2019-08-26T12:56:08.631Z",
                originalLanguage: "EN",
                conditions: {},
                context: "",
                support: {
                    generator: "Change.createInitialFileContent",
                    service: "",
                    user: "",
                },
            }),
        });
    }
);
