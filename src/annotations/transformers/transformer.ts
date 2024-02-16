import Language from "../../model/language";
import ServiceRequestor from "../serviceRequestor";

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
