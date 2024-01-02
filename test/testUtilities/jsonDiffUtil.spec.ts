import JsonDiffUtil, { IDiffJson } from "../../src/util/jsonDiffUtil";

import TestUtil from "./testUtil";
import XmlUtil from "../../src/util/xmlUtil";
import { expect } from "chai";

describe("JsonDiffUtil", () => {

    describe("when return diff properties", () => {

        describe("when comparing 2 diff structure jsons", () => {
            it("should throw error", () => {
                const jsonA = XmlUtil.xmlToJson(TestUtil.getResource("annotationNameDiffStr-de.xml"));
                const jsonB = XmlUtil.xmlToJson(TestUtil.getResource("annotationNameDiffStr-fr.xml"));
                expect(() => JsonDiffUtil.diff(jsonA, jsonB)).to.throw(`{"_attributes":{"Term":"com.sap.vocabularies.Common.v1.Label","String":"Compagnie aérienne","Value":"Compagnie aérienne"}}`);
            });
        });

        describe("when comparing 2 jsons", () => {

            let result: IDiffJson;
            before(() => {
                const jsonA = { edmx: { _attributes: { values: "A" } } };
                const jsonB = { edmx: { _attributes: { values: "B" } } };
                result = JsonDiffUtil.diff(jsonA, jsonB);
            });

            it("should return jsanA with diff", () => {
                expect(result.json).to.eql({
                    edmx: {
                        _attributes: {
                            values: {
                                __new: "B",
                                __old: "A"
                            }
                        }
                    }
                });
            });

            it("should update the property", () => {
                for (const { object, property } of result.properties) {
                    object[property] = "{@i18n>AB}";
                }
                expect(result.json).to.eql({
                    edmx: {
                        _attributes: {
                            values: "{@i18n>AB}"
                        }
                    }
                });
            });
        });


        it("should return values in array same order irrellevant of jsonA/jsonB or jsonB/jsonA comparison", () => {
            const jsonA = { edmx: { _attributes: { values: [{ value3: "4", value1: "1", value2: "2" }] } } };
            const jsonB = { edmx: { _attributes: { values: [{ value3: "4", value2: "1", value1: "3" }] } } };
            const resultA = JsonDiffUtil.diff(jsonA, jsonB);
            const resultB = JsonDiffUtil.diff(jsonB, jsonA);
            expect(resultA.json).to.eql({
                edmx: {
                    _attributes: {
                        values: [
                            {
                                value1: { __new: "3", __old: "1" },
                                value2: { __new: "1", __old: "2" },
                                value3: "4"
                            }
                        ]
                    }
                }
            });
            expect(resultB.json).to.eql({
                edmx: {
                    _attributes: {
                        values: [
                            {
                                value1: { __new: "1", __old: "3" },
                                value2: { __new: "2", __old: "1" },
                                value3: "4"
                            }
                        ]
                    }
                }
            });
        });
    });

});