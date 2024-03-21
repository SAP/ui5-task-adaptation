import * as fs from "fs";
import * as path from "path";

import AnnotationUtil from "../../testUtilities/annotationUtil.js";
import MetadataJsonUtil from "../../../src/annotations/converter/metadataJsonUtil.js";
import TestUtil from "../../testUtilities/testUtil.js";
import UI5JsonParser from "../../../src/annotations/converter/ui5MetadataJsonUtil.js";
import UI5ToInternalJsonConverter from "../../../src/annotations/converter/ui5JsonConverter.js";
import UI5XmlToJsonConverter from "../../../src/annotations/converter/ui5XmlConverter.js";
import XmlUtil from "../../../src/util/xmlUtil.js";
import { expect } from "chai"

const TARGET = "com.sap.gateway.srvd.m2_sd_travel_mduu.v0001.BookingSupplementType/SupplementID";
const SERVICE_NAMESPACE = 'com.sap.gateway.srvd.m2_sd_travel_mduu.v0001';

describe("When converting ui5 json into internal json", () => {

    function testConversion(ui5Annotation: any, expectedJsonAnnotation: any) {
        const result = UI5ToInternalJsonConverter.processAnnotations(structuredClone(ui5Annotation), TARGET);
        expect(result).to.eql(wrap(expectedJsonAnnotation));

        // Do the whole round: Produce final xml, then check what UI5 parser will produce -> Must be original input
        const xml = XmlUtil.jsonToXml(result);
        const ui5Result = UI5XmlToJsonConverter.convertV4(wrapXML(xml));
        const ui5AnnotationResult = ui5Result[SERVICE_NAMESPACE + "."].$Annotations[TARGET];

        expect(ui5AnnotationResult).to.eql(ui5Annotation);
    }

    it("should convert inline annotations", async () => {
        testConversion({
            "@com.sap.vocabularies.Common.v1.Text": {
                "$Path": "SupplementDescription"
            },
            "@com.sap.vocabularies.Common.v1.Text@com.sap.vocabularies.UI.v1.TextArrangement": {
                "$EnumMember": "com.sap.vocabularies.UI.v1.TextArrangementType/TextOnly"
            }
        }, {
            _attributes: {
                Term: 'com.sap.vocabularies.Common.v1.Text',
                Path: 'SupplementDescription'
            },
            Annotation: {
                _attributes: {
                    Term: 'com.sap.vocabularies.UI.v1.TextArrangement',
                    EnumMember: 'com.sap.vocabularies.UI.v1.TextArrangementType/TextOnly'
                }
            }
        });
    });

    it("should convert qualifier", async () => {
        testConversion({
            "@com.sap.vocabularies.UI.v1.Chart#PartnerCostCtrActivityTypeChart": {
                $Type: "com.sap.vocabularies.UI.v1.ChartDefinitionType",
            }
        }, {
            _attributes: {
                Term: "com.sap.vocabularies.UI.v1.Chart",
                Qualifier: "PartnerCostCtrActivityTypeChart",
            },
            Record: {
                _attributes: {
                    Type: "com.sap.vocabularies.UI.v1.ChartDefinitionType",
                },
            },
        });
    });

    it("should convert record with annotation", async () => {
        testConversion({
            "@com.sap.vocabularies.UI.v1.LineItem": [
                {
                    "@com.sap.vocabularies.UI.v1.Importance": {
                        "$EnumMember": "com.sap.vocabularies.UI.v1.ImportanceType/High"
                    },
                    "$Type": "com.sap.vocabularies.UI.v1.DataField"
                }
            ]
        }, {
            "_attributes": {
                "Term": "com.sap.vocabularies.UI.v1.LineItem"
            },
            "Collection": {
                "Record": {
                    "_attributes": {
                        "Type": "com.sap.vocabularies.UI.v1.DataField"
                    },
                    "Annotation": {
                        "_attributes": {
                            "Term": "com.sap.vocabularies.UI.v1.Importance",
                            "EnumMember": "com.sap.vocabularies.UI.v1.ImportanceType/High"
                        }
                    }
                }
            }
        });
    });

    it("should convert simple types", async () => {
        testConversion({
            "@com.sap.vocabularies.Common.v1.IsUpperCase": true,
            "@com.sap.vocabularies.Common.v1.Sortable": false,
            "@com.sap.vocabularies.Common.v1.Label": "Postal Code",
            "@com.sap.vocabularies.Common.v1.quickinfo": 1
        }, [{
            "_attributes": {
                "Term": "com.sap.vocabularies.Common.v1.IsUpperCase"
            }
        }, {
            "_attributes": {
                "Term": "com.sap.vocabularies.Common.v1.Sortable",
                "Bool": "false"
            }
        }, {
            "_attributes": {
                "Term": "com.sap.vocabularies.Common.v1.Label",
                "String": "Postal Code"
            }
        }, {
            "_attributes": {
                "Term": "com.sap.vocabularies.Common.v1.quickinfo",
                "Int": "1"
            }
        }]);
    });

    it("should convert boolean term explicit to attribute", async () => {
        testConversion({
            "@Org.OData.Capabilities.V1.NavigationRestrictions": {
                "RestrictedProperties": [
                    {
                        "InsertRestrictions": {
                            "Insertable": false,
                            "Sortable": true
                        }
                    }
                ]
            }
        }, {
            "_attributes": {
                "Term": "Org.OData.Capabilities.V1.NavigationRestrictions"
            },
            "Record": {
                "PropertyValue": {
                    "_attributes": {
                        "Property": "RestrictedProperties"
                    },
                    "Collection": {
                        "Record": {
                            "PropertyValue": {
                                "_attributes": {
                                    "Property": "InsertRestrictions"
                                },
                                "Record": {
                                    "PropertyValue": [{
                                        "_attributes": {
                                            "Property": "Insertable",
                                            "Bool": "false"
                                        }
                                    }, {
                                        "_attributes": {
                                            "Property": "Sortable",
                                            "Bool": "true"
                                        }
                                    }]
                                }
                            }
                        }
                    }
                }
            }
        });
    });

    it("should convert wrapped attribute in collection", async () => {
        testConversion({
            "@com.sap.vocabularies.UI.v1.PresentationVariant": {
                "Visualizations": [
                    {
                        "$AnnotationPath": "@com.sap.vocabularies.UI.v1.LineItem"
                    }
                ]
            }
        }, {
            "_attributes": {
                "Term": "com.sap.vocabularies.UI.v1.PresentationVariant"
            },
            "Record": {
                "PropertyValue": {
                    "_attributes": {
                        "Property": "Visualizations"
                    },
                    "Collection": {
                        "AnnotationPath": {
                            "_text": "@com.sap.vocabularies.UI.v1.LineItem"
                        }
                    }
                }
            }
        });
    });

    it("should convert string in collection", async () => {
        testConversion({
            "@com.sap.vocabularies.Common.v1.ValueListReferences": [
                "\n                            ../../../../srvd_f4/sap/i_countryvh/0001;ps='srvd-m2_sd_travel_mduu-0001';va='com.sap.gateway.srvd.m2_sd_travel_mduu.v0001.et-*dmo*i_agency.countrycode'/$metadata"
            ]
        }, {
            "_attributes": {
                "Term": "com.sap.vocabularies.Common.v1.ValueListReferences"
            },
            "Collection": {
                "String": {
                    "_text": "\n                            ../../../../srvd_f4/sap/i_countryvh/0001;ps='srvd-m2_sd_travel_mduu-0001';va='com.sap.gateway.srvd.m2_sd_travel_mduu.v0001.et-*dmo*i_agency.countrycode'/$metadata"
                }
            }
        });
    });

    it("should process inline annotation with array and title as object", async () => {
        testConversion({
            "@com.sap.vocabularies.UI.v1.HeaderInfo@Org.OData.Core.V1.Messages": [
                {
                    "message": "UI.HEADERINFO: TypeNamePlural is mandatory",
                    "severity": "error",
                },
            ],
            "@com.sap.vocabularies.UI.v1.HeaderInfo": {
                "TypeName": "",
                "Title": {
                    "$Type": "com.sap.vocabularies.UI.v1.DataField",
                    "Value": {
                        "$Path": "ExtractedItemIndex",
                    },
                },
            },
        }, {
            _attributes: {
                Term: "com.sap.vocabularies.UI.v1.HeaderInfo",
            },
            Record: {
                PropertyValue: [
                    {
                        _attributes: {
                            Property: "TypeName",
                            String: "",
                        },
                    },
                    {
                        _attributes: {
                            Property: "Title",
                        },
                        Record: {
                            _attributes: {
                                Type: "com.sap.vocabularies.UI.v1.DataField",
                            },
                            PropertyValue: {
                                _attributes: {
                                    Property: "Value",
                                    Path: "ExtractedItemIndex",
                                },
                            },
                        },
                    },
                ],
            },
            Annotation: {
                _attributes: {
                    Term: "Org.OData.Core.V1.Messages",
                },
                Collection: {
                    Record: {
                        PropertyValue: [
                            {
                                _attributes: {
                                    Property: "message",
                                    String: "UI.HEADERINFO: TypeNamePlural is mandatory",
                                },
                            },
                            {
                                _attributes: {
                                    Property: "severity",
                                    String: "error",
                                },
                            },
                        ],
                    },
                },
            },
        });
    });

    it("should process collection and switching property position of Path, EnumMember with Term, Property", async () => {
        testConversion({
            "@com.sap.vocabularies.UI.v1.Identification": [
                {
                    "@com.sap.vocabularies.UI.v1.PartOfPreview": false,
                    "@com.sap.vocabularies.UI.v1.Importance": {
                        $EnumMember: "com.sap.vocabularies.UI.v1.ImportanceType/High",
                    },
                    $Type: "com.sap.vocabularies.UI.v1.DataField",
                    Value: {
                        $Path: "AccountingDocument",
                    },
                },
                {
                    $Type: "com.sap.vocabularies.UI.v1.DataField",
                    Value: {
                        $Path: "ExtractedItemIndex",
                    },
                },
                {
                    $Type: "com.sap.vocabularies.UI.v1.DataField",
                    Value: {
                        $Path: "CompanyCode",
                    },
                },
            ]
        }, {
            _attributes: {
                Term: "com.sap.vocabularies.UI.v1.Identification",
            },
            Collection: {
                Record: [
                    {
                        _attributes: {
                            Type: "com.sap.vocabularies.UI.v1.DataField",
                        },
                        PropertyValue: {
                            _attributes: {
                                Property: "Value",
                                Path: "AccountingDocument",
                            },
                        },
                        Annotation: [
                            {
                                _attributes: {
                                    Term: "com.sap.vocabularies.UI.v1.PartOfPreview",
                                    Bool: "false"
                                },
                            },
                            {
                                _attributes: {
                                    Term: "com.sap.vocabularies.UI.v1.Importance",
                                    EnumMember: "com.sap.vocabularies.UI.v1.ImportanceType/High",
                                },
                            },
                        ],
                    },
                    {
                        _attributes: {
                            Type: "com.sap.vocabularies.UI.v1.DataField",
                        },
                        PropertyValue: {
                            _attributes: {
                                Property: "Value",
                                Path: "ExtractedItemIndex",
                            },
                        },
                    },
                    {
                        _attributes: {
                            Type: "com.sap.vocabularies.UI.v1.DataField",
                        },
                        PropertyValue: {
                            _attributes: {
                                Property: "Value",
                                Path: "CompanyCode",
                            },
                        },
                    },
                ],
            },
        });
    });

    it("should process inline annotation with collection", async () => {
        testConversion({
            "@com.sap.vocabularies.UI.v1.LineItem@com.sap.vocabularies.UI.v1.Criticality": {
                $Path: "StatusCriticality",
            },
            "@com.sap.vocabularies.UI.v1.LineItem": [
                {
                    "@com.sap.vocabularies.UI.v1.Importance": {
                        $EnumMember: "com.sap.vocabularies.UI.v1.ImportanceType/High",
                    },
                    $Type: "com.sap.vocabularies.UI.v1.DataField",
                    Criticality: {
                        $Path: "StatusCriticality",
                    },
                    CriticalityRepresentation: {
                        $EnumMember: "com.sap.vocabularies.UI.v1.CriticalityRepresentationType/WithoutIcon",
                    },
                    Value: {
                        $Path: "OutgoingInvoiceStatus",
                    },
                },
                {
                    "@com.sap.vocabularies.UI.v1.Importance": {
                        $EnumMember: "com.sap.vocabularies.UI.v1.ImportanceType/High",
                    },
                    $Type: "com.sap.vocabularies.UI.v1.DataField",
                    Value: {
                        $Path: "ExtractedItemIndex",
                    },
                },
                {
                    "@com.sap.vocabularies.UI.v1.Importance": {
                        $EnumMember: "com.sap.vocabularies.UI.v1.ImportanceType/High",
                    },
                    $Type: "com.sap.vocabularies.UI.v1.DataField",
                    Label: "Document Date",
                    Value: {
                        $Path: "InvoiceDate",
                    },
                }
            ]
        }, {
            _attributes: {
                Term: "com.sap.vocabularies.UI.v1.LineItem",
            },
            Collection: {
                Record: [
                    {
                        _attributes: {
                            Type: "com.sap.vocabularies.UI.v1.DataField",
                        },
                        PropertyValue: [
                            {
                                _attributes: {
                                    Property: "Criticality",
                                    Path: "StatusCriticality",
                                },
                            },
                            {
                                _attributes: {
                                    Property: "CriticalityRepresentation",
                                    EnumMember: "com.sap.vocabularies.UI.v1.CriticalityRepresentationType/WithoutIcon",
                                },
                            },
                            {
                                _attributes: {
                                    Property: "Value",
                                    Path: "OutgoingInvoiceStatus",
                                },
                            },
                        ],
                        Annotation: {
                            _attributes: {
                                Term: "com.sap.vocabularies.UI.v1.Importance",
                                EnumMember: "com.sap.vocabularies.UI.v1.ImportanceType/High",
                            },
                        },
                    },
                    {
                        _attributes: {
                            Type: "com.sap.vocabularies.UI.v1.DataField",
                        },
                        PropertyValue: {
                            _attributes: {
                                Property: "Value",
                                Path: "ExtractedItemIndex",
                            },
                        },
                        Annotation: {
                            _attributes: {
                                Term: "com.sap.vocabularies.UI.v1.Importance",
                                EnumMember: "com.sap.vocabularies.UI.v1.ImportanceType/High",
                            },
                        },
                    },
                    {
                        _attributes: {
                            Type: "com.sap.vocabularies.UI.v1.DataField",
                        },
                        PropertyValue: [
                            {
                                _attributes: {
                                    Property: "Label",
                                    String: "Document Date",
                                },
                            },
                            {
                                _attributes: {
                                    Property: "Value",
                                    Path: "InvoiceDate",
                                },
                            },
                        ],
                        Annotation: {
                            _attributes: {
                                Term: "com.sap.vocabularies.UI.v1.Importance",
                                EnumMember: "com.sap.vocabularies.UI.v1.ImportanceType/High",
                            },
                        },
                    }
                ],
            },
            Annotation: {
                _attributes: {
                    Term: "com.sap.vocabularies.UI.v1.Criticality",
                    Path: "StatusCriticality",
                },
            },
        });
    });

    it("should proccess annotation with empty navigation property path", async () => {
        testConversion({
            "@com.sap.vocabularies.Common.v1.SideEffects#SAP__Field_GLAccount": {
                $Type: "com.sap.vocabularies.Common.v1.SideEffectsType",
                SourceProperties: [
                    {
                        $PropertyPath: "GLAccount",
                    },
                ],
                TargetEntities: [
                    {
                        $NavigationPropertyPath: "",
                    },
                ],
            }
        }, {
            _attributes: {
                Term: "com.sap.vocabularies.Common.v1.SideEffects",
                Qualifier: "SAP__Field_GLAccount",
            },
            Record: {
                _attributes: {
                    Type: "com.sap.vocabularies.Common.v1.SideEffectsType",
                },
                PropertyValue: [
                    {
                        _attributes: {
                            Property: "SourceProperties",
                        },
                        Collection: {
                            PropertyPath: {
                                _text: "GLAccount",
                            },
                        },
                    },
                    {
                        _attributes: {
                            Property: "TargetEntities",
                        },
                        Collection: {
                            NavigationPropertyPath: {},
                        },
                    },
                ],
            },
        });
    });


    it("process simple nested annotations", async () => {
        testConversion({
            "@com.sap.vocabularies.UI.v1.FieldGroup#ConditionRateValue": {
                Data: [{
                    "@com.sap.vocabularies.Common.v1.Label": "Postal Code",
                    "@com.sap.vocabularies.UI.v1.Hidden": {
                        $Path: "UICT_CndRateValueIsNull",
                    },
                    "@com.sap.vocabularies.UI.v1.Importance": {
                        $EnumMember: "com.sap.vocabularies.UI.v1.ImportanceType/High",
                    },
                    $Type: "com.sap.vocabularies.UI.v1.DataField",
                    "Target@Org.OData.Core.V1.Messages": [
                        {
                            code: "SY-531"
                        }
                    ],
                    Target: "UI.FACET$5$"
                }],
                Label: "Condition Amount or Ratio",
            }
        }, {
            _attributes: {
                Term: "com.sap.vocabularies.UI.v1.FieldGroup",
                Qualifier: "ConditionRateValue",
            },
            Record: {
                PropertyValue: [
                    {
                        _attributes: {
                            Property: "Data"
                        },
                        Collection: {
                            Record: {
                                _attributes: {
                                    Type: "com.sap.vocabularies.UI.v1.DataField"
                                },
                                Annotation: [{
                                    _attributes: {
                                        Term: "com.sap.vocabularies.Common.v1.Label",
                                        String: "Postal Code"
                                    }
                                }, {
                                    _attributes: {
                                        Term: "com.sap.vocabularies.UI.v1.Hidden",
                                        Path: "UICT_CndRateValueIsNull"
                                    }
                                }, {
                                    _attributes: {
                                        Term: "com.sap.vocabularies.UI.v1.Importance",
                                        EnumMember: "com.sap.vocabularies.UI.v1.ImportanceType/High"
                                    }
                                }],
                                PropertyValue: {
                                    _attributes: {
                                        Property: "Target",
                                        String: "UI.FACET$5$"
                                    },
                                    Annotation: {
                                        _attributes: {
                                            Term: "Org.OData.Core.V1.Messages"
                                        },
                                        Collection: {
                                            Record: {
                                                PropertyValue: {
                                                    _attributes: {
                                                        Property: "code",
                                                        String: "SY-531"
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }, {
                        _attributes: {
                            Property: "Label",
                            String: "Condition Amount or Ratio"
                        }
                    }
                ],
            },
        });
    });

    it("process nested annotations with single and multiple annotations in property values", async () => {
        testConversion({
            "@com.sap.vocabularies.UI.v1.FieldGroup#ConditionRateValue": {
                Data: [
                    {
                        "@com.sap.vocabularies.Common.v1.Label": "Postal Code",
                        "@com.sap.vocabularies.UI.v1.Hidden": {
                            $Path: "UICT_CndRateValueIsNull",
                        },
                        "@com.sap.vocabularies.UI.v1.Importance": {
                            $EnumMember: "com.sap.vocabularies.UI.v1.ImportanceType/High",
                        },
                        $Type: "com.sap.vocabularies.UI.v1.DataField",
                        Value: {
                            $Path: "ConditionRateAmount",
                        },
                        "Target@Org.OData.Capabilities.V1.NavigationRestrictions": [
                            {
                                code: "SY-530"
                            },
                        ],
                        "Target@Org.OData.Core.V1.Messages": [
                            {
                                code: "SY-531"
                            },
                        ],
                        Target: "UI.FACET$5$"
                    },
                    {
                        "@com.sap.vocabularies.UI.v1.Hidden": {
                            $Path: "UICT_CndRateValueIsNull",
                        },
                        "@com.sap.vocabularies.UI.v1.Importance": {
                            $EnumMember: "com.sap.vocabularies.UI.v1.ImportanceType/High",
                        },
                        $Type: "com.sap.vocabularies.UI.v1.DataField",
                        Value: {
                            $Path: "ConditionRateRatio",
                        },
                        "Target@Org.OData.Core.V1.Messages": [
                            {
                                code: "SY-530"
                            },
                        ],
                        Target: "UI.FACET$2$"
                    }
                ],
                Label: "Condition Amount or Ratio",
            }
        }, {
            _attributes: {
                Term: "com.sap.vocabularies.UI.v1.FieldGroup",
                Qualifier: "ConditionRateValue",
            },
            Record: {
                PropertyValue: [
                    {
                        _attributes: {
                            Property: "Data",
                        },
                        Collection: {
                            Record: [
                                {
                                    _attributes: {
                                        Type: "com.sap.vocabularies.UI.v1.DataField",
                                    },
                                    PropertyValue: [{
                                        _attributes: {
                                            Property: "Value",
                                            Path: "ConditionRateAmount",
                                        },
                                    }, {
                                        _attributes: {
                                            Property: "Target",
                                            String: "UI.FACET$5$",
                                        },
                                        Annotation: [
                                            {
                                                _attributes: {
                                                    Term:
                                                        "Org.OData.Capabilities.V1.NavigationRestrictions"
                                                },
                                                Collection: {
                                                    Record: {
                                                        PropertyValue: {
                                                            _attributes: {
                                                                Property: "code",
                                                                String: "SY-530"
                                                            }
                                                        }
                                                    }
                                                }
                                            }, {
                                                _attributes: {
                                                    Term: "Org.OData.Core.V1.Messages"
                                                },
                                                Collection: {
                                                    Record: {
                                                        PropertyValue: {
                                                            _attributes: {
                                                                Property: "code",
                                                                String: "SY-531"
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        ]
                                    }],
                                    Annotation: [
                                        {
                                            _attributes: {
                                                Term: "com.sap.vocabularies.Common.v1.Label",
                                                String: "Postal Code",
                                            },
                                        },
                                        {
                                            _attributes: {
                                                Term: "com.sap.vocabularies.UI.v1.Hidden",
                                                Path: "UICT_CndRateValueIsNull",
                                            },
                                        },
                                        {
                                            _attributes: {
                                                Term: "com.sap.vocabularies.UI.v1.Importance",
                                                EnumMember: "com.sap.vocabularies.UI.v1.ImportanceType/High",
                                            },
                                        },
                                    ],
                                },
                                {
                                    _attributes: {
                                        Type: "com.sap.vocabularies.UI.v1.DataField",
                                    },
                                    PropertyValue: [{
                                        _attributes: {
                                            Property: "Value",
                                            Path: "ConditionRateRatio",
                                        }
                                    }, {
                                        _attributes: {
                                            Property: "Target",
                                            String: "UI.FACET$2$",
                                        },
                                        Annotation: {
                                            _attributes: {
                                                Term: "Org.OData.Core.V1.Messages"
                                            },
                                            Collection: {
                                                Record: {
                                                    PropertyValue: {
                                                        _attributes: {
                                                            Property: "code",
                                                            String: "SY-530"
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }],
                                    Annotation: [
                                        {
                                            _attributes: {
                                                Term: "com.sap.vocabularies.UI.v1.Hidden",
                                                Path: "UICT_CndRateValueIsNull",
                                            },
                                        },
                                        {
                                            _attributes: {
                                                Term: "com.sap.vocabularies.UI.v1.Importance",
                                                EnumMember: "com.sap.vocabularies.UI.v1.ImportanceType/High",
                                            },
                                        },
                                    ],
                                },
                            ],
                        },
                    },
                    {
                        _attributes: {
                            Property: "Label",
                            String: "Condition Amount or Ratio",
                        },
                    },
                ],
            },
        });
    });

    const tempPathRelative = "metadata/download";
    const tempPath = TestUtil.getResourcePath(tempPathRelative);
    if (fs.existsSync(tempPath)) {
        const filenames = fs.readdirSync(tempPath);
        for (const filename of filenames.filter(file => file.endsWith(".xml"))) {
            const relativeFilename = path.join(tempPathRelative, filename);
            const xml = TestUtil.getResourceXml(relativeFilename);
            if (!xml.includes('Version="4.0"')) {
                continue;
            }
            describe(`when converting ${relativeFilename}`, () => {
                const notFoundTargets: string[] = [];
                const internalJson = AnnotationUtil.normalizeToCompareWithUI5(XmlUtil.xmlToJson(xml));
                const annotationsByTarget = MetadataJsonUtil.mapAnnotationsPerTarget(internalJson);
                const ui5Json = UI5XmlToJsonConverter.convertV4(xml);
                const annotations = UI5JsonParser.getAnnotationsNode(ui5Json);
                for (const target of Object.keys(annotations)) {
                    it(`should convert ${target}`, () => {
                        const actual = UI5ToInternalJsonConverter.processAnnotations(annotations[target], target);
                        const expected = annotationsByTarget.get(target);
                        if (expected) {
                            expect(actual).to.eql(expected.json);
                        } else {
                            notFoundTargets.push(target);
                        }
                    });
                }
                after(() => {
                    if (notFoundTargets.length > 0) {
                        console.log("\tNot found targets:");
                        for (const target of notFoundTargets) {
                            console.log("\t" + target);
                        }
                    }
                });
            });
        }
    }

});

function wrap(json: any) {
    return {
        _attributes: {
            Target: TARGET
        },
        Annotation: json
    }
}


function wrapXML(xml: string) {
    return `
        <edmx:Edmx xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx" Version="4.0">
            <edmx:DataServices>
                <Schema xmlns="http://docs.oasis-open.org/odata/ns/edm" Namespace="${SERVICE_NAMESPACE}">
                    <Annotations Target="${TARGET}">

                    ${xml}

                    </Annotations>
                </Schema>
            </edmx:DataServices>
        </edmx:Edmx>
    `
}
