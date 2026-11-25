import Language from "../../model/language.js";
import IRepository from "../../repositories/repository.js";

export interface TransformerInput {
    uri: string;
    json: any;
    xml: string;
    language: Language;
    repository: IRepository
}

export default interface Transformer {
    transform(input: TransformerInput): any;
}
