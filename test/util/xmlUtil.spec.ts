import XmlUtil from "../../src/util/xmlUtil";
import { expect } from "chai";

describe("XmlUtil", () => {

    describe("when converting json to xml", () => {
        const JSON = {
            "edmx:Include": {
                _attributes: {
                    values: `&&&amp;&amp;<<>>''""`
                }
            }
        };
        const XML = `<edmx:Include values="&amp;&amp;&amp;amp;&amp;amp;&lt;&lt;>>&apos;&apos;&quot;&quot;"/>`
        it("should encode", () => expect(XmlUtil.jsonToXml(JSON)).to.eql(XML));
        it("should decode back", () => expect(XmlUtil.xmlToJson(XML)).to.eql(JSON));
        it("should encode decode", () => expect(XmlUtil.jsonToXml(XmlUtil.xmlToJson(XML))).to.eql(XML));
        it("should decode encode", () => expect(XmlUtil.xmlToJson(XmlUtil.jsonToXml(JSON))).to.eql(JSON));
    });

});