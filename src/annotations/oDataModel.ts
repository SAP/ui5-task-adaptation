import ServiceRequestor, { ILanguageJsonContent, ILanguageXmlContent } from "./serviceRequestor";

import XmlUtil from "../util/xmlUtil";
import Language from "../model/language";

export default class ODataModel {

    protected oDataAnnotations = new Map<string, any>();
    private serviceRequestor: ServiceRequestor;

    constructor(serviceRequestor: ServiceRequestor) {
        this.serviceRequestor = serviceRequestor;
    }


    getAnnotationJsons(languages: Language[]): AnnotationJsonPerName[] {
        const result = [];
        const promisesPerLanguagePerName = this.getPromisesPerLanguage(languages)
        for (const { promisesPerLanguage, annotationName } of promisesPerLanguagePerName) {
            result.push({
                annotationName,
                annotationJsons: this.createAnnotationJsons(promisesPerLanguage)
            });
        }
        return result;
    }


    private getPromisesPerLanguage(languages: Language[]) {
        return [...this.oDataAnnotations].map(([annotationName, uri]) => ({
            promisesPerLanguage: languages.map(language =>
                this.serviceRequestor.downloadAnnotation(uri, annotationName, language)
                    .then(this.afterXmlDownload)),
            annotationName
        }));
    }


    private async createAnnotationJsons(promisesPerLanguage: Promise<ILanguageJsonContent>[]): Promise<Map<Language, any>> {
        const annotationJsons = new Map<Language, any>();
        for (const promise of promisesPerLanguage) {
            const { language, json } = await promise;
            annotationJsons.set(language, json);
        }
        return this.transformJsons(annotationJsons);
    }


    protected async afterXmlDownload({ language, xml }: ILanguageXmlContent): Promise<ILanguageJsonContent> {
        return {
            json: XmlUtil.xmlToJson(xml),
            language
        }
    }


    protected async transformJsons(annotationJsons: Map<Language, any>): Promise<Map<Language, any>> {
        return annotationJsons
    }

}

export interface PromisePerAnnotation {
    promisesPerLanguage: Promise<ILanguageXmlContent>[];
    annotationName: string;
}

export interface AnnotationJsonPerName {
    annotationName: string,
    annotationJsons: Promise<Map<Language, any>>
}