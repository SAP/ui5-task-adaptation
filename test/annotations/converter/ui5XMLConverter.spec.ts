import ui5XmlConverter from "../../../src/annotations/converter/ui5XmlConverter";
import { expect } from "chai"


describe("When converting v2 metadata into internal json", () => {

    it("should extract sap annotations and merge", async () => {
        const result = ui5XmlConverter.convertV2(`<?xml version="1.0" encoding="utf-8"?>
        <edmx:Edmx Version="1.0" xmlns:edmx="http://schemas.microsoft.com/ado/2007/06/edmx" xmlns:m="http://schemas.microsoft.com/ado/2007/08/dataservices/metadata" xmlns:sap="http://www.sap.com/Protocols/SAPData">
            <edmx:Reference Uri="https://mysystem/sap/opu/odata/iwfnd/catalogservice;v=2/Vocabularies(TechnicalName='%2FIWBEP%2FVOC_COMMON',Version='0001',SAP__Origin='LOCAL')/$value" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
                <edmx:Include Namespace="com.sap.vocabularies.Common.v1" Alias="Common"/>
            </edmx:Reference>
        
            <edmx:DataServices m:DataServiceVersion="2.0">
                <Schema Namespace="service_namespace" xml:lang="en" sap:schema-version="1" xmlns="http://schemas.microsoft.com/ado/2008/09/edm">
                    <EntityType Name="EntityType1" sap:label="Old sap:label Annotation" sap:value-list="true" sap:content-version="1">
                        <Key>
                            <PropertyRef Name="PropertyWithSAPAnnotation"/>
                        </Key>
                        <Property Name="PropertyWithSAPAnnotation" Type="Edm.String" Nullable="false" MaxLength="1" sap:display-format="NonNegative" sap:text="PropertyWitSAPAndV4Annotation" sap:label="Priority"/>
                        <Property Name="PropertyWitSAPAndV4Annotation" Type="Edm.String" MaxLength="40" sap:label="Name" sap:quickinfo="Old sap:quickinfo Annotation" sap:creatable="false" sap:updatable="false"/>
                        <Property Name="PropertyWithoutSAPAnnotations" Type="Edm.String" MaxLength="40"/>
                    </EntityType>
        
                    <Annotation Term="Core.SchemaVersion" String="1.0.0" xmlns="http://docs.oasis-open.org/odata/ns/edm"/>

                    <Annotations Target="service_namespace.EntityType1/V4AnnotationOnly" xmlns="http://docs.oasis-open.org/odata/ns/edm">
                        <Annotation Term="Common.ValueList">
                            <Record>
                                <PropertyValue Property="Label" String="Currency"/>
                            </Record>
                        </Annotation>
                    </Annotations>

                    <Annotations Target="service_namespace.EntityType1/PropertyWitSAPAndV4Annotation" xmlns="http://docs.oasis-open.org/odata/ns/edm">
                        <Annotation Term="Common.ValueList">
                            <Record>
                                <PropertyValue Property="Label" String="Credit Segment"/>
                            </Record>
                        </Annotation>
                    </Annotations>
                </Schema>
            </edmx:DataServices>
        </edmx:Edmx>
        `);
        expect(result).to.eql({
            "$Reference": {
                "https://mysystem/sap/opu/odata/iwfnd/catalogservice;v=2/Vocabularies(TechnicalName='%2FIWBEP%2FVOC_COMMON',Version='0001',SAP__Origin='LOCAL')/$value": {
                    "$Include": ["com.sap.vocabularies.Common.v1."]
                }
            },
            "service_namespace.": {
                "$kind": "Schema",
                "@Org.Odata.Core.V1.SchemaVersion": "1",
                "$Annotations": {
                    "service_namespace.EntityType1/V4AnnotationOnly": {
                        "@com.sap.vocabularies.Common.v1.ValueList": {
                            "Label": "Currency"
                        }
                    },
                    "service_namespace.EntityType1/PropertyWitSAPAndV4Annotation": { // Merged SAP and V4 Target
                        "@com.sap.vocabularies.Common.v1.ValueList": {
                            "Label": "Credit Segment"
                        },
                        "@com.sap.vocabularies.Common.v1.Label": "Name",
                        "@com.sap.vocabularies.Common.v1.QuickInfo": "Old sap:quickinfo Annotation",
                        "@Org.OData.Core.V1.Computed": true
                    },
                    "service_namespace.EntityType1": {
                        "@com.sap.vocabularies.Common.v1.Label": "Old sap:label Annotation"
                    },
                    "service_namespace.EntityType1/PropertyWithSAPAnnotation": {
                        "@com.sap.vocabularies.Common.v1.IsDigitSequence": true,
                        "@com.sap.vocabularies.Common.v1.Text": {
                            "$Path": "PropertyWitSAPAndV4Annotation"
                        },
                        "@com.sap.vocabularies.Common.v1.Label": "Priority"
                    },
                    
                }
            },
            "service_namespace.EntityType1": {
                "$kind": "EntityType",
                "$Key": ["PropertyWithSAPAnnotation"],
                "PropertyWithSAPAnnotation": {
                    "$kind": "Property",
                    "$MaxLength": 1,
                    "$Nullable": false,
                    "$Type": "Edm.String"
                },
                "PropertyWitSAPAndV4Annotation": {
                    "$kind": "Property",
                    "$MaxLength": 40,
                    "$Type": "Edm.String"
                },
                "PropertyWithoutSAPAnnotations": {
                    "$MaxLength": 40,
                    "$Type": "Edm.String",
                    "$kind": "Property",
                }
            },
            "$Version": "4.0"
        });
    });


});

