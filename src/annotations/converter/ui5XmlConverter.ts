const { V2MetadataConverter, V4MetadataConverter } = require("../../../dist/bundle-odata");

import { JSDOM } from "jsdom";

export default class UI5XmlConverter {

    static convertV2(xml: string) {
        return new V2MetadataConverter().convertXMLMetadata(this.getDocument(xml));
    }

    static convertV4(xml: string) {
        return new V4MetadataConverter().convertXMLMetadata(this.getDocument(xml));
    }

    private static getDocument(xml: string) {
        return (new JSDOM(xml, { contentType: "application/xml" })).window._document;
    }
}