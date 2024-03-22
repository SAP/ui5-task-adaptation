import Language from "../../model/language.js";
import ServiceRequestor from "../serviceRequestor.js";

export interface TransformerInput {
    uri: string;
    json: any;
    xml: string;
    language: Language;
    serviceRequestor: ServiceRequestor
}

export default interface Transformer {
    transform(input: TransformerInput): any;
}
