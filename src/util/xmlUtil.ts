import * as convert from "xml-js";

const XML_OPTIONS = { compact: true, spaces: 4 };

export default class XmlUtil {

    static jsonToXml(json: any) {
        return convert.json2xml(json, {
            ...XML_OPTIONS, attributeValueFn: (val) => val
                .replaceAll("&quot;", "\"")
                .replaceAll("&", "&amp;")
                .replaceAll("<", "&lt;")
                .replaceAll("\"", "&quot;")
                .replaceAll("'", "&apos;")
        });
    }

    static xmlToJson(xml: string) {
        return JSON.parse(convert.xml2json(xml, {
            ...XML_OPTIONS, attributeValueFn: (val) => val
                .replaceAll("&quot;", "\"")
        }));
    }

}