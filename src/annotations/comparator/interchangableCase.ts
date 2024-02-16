import { Diff } from "./comparator";
import DiffCase from "./diffCase";

export default class InterchangableCase implements DiffCase {

    accept(target: any[], i: number, name: string): void {
        if (name === "Annotation" && this.interchangableTerms.includes(target[i]?._attributes?.Term)) {
            const source = this.findByPriority(target, i);
            if (source) {
                for (const attribute of Object.keys(source._attributes)) {
                    if (attribute !== "Term") {
                        const sourceValue = this.getSourceValue(source, attribute);
                        target[i]._attributes[attribute] = sourceValue;
                    }
                }
            }
        }
    }

    /**
     * When default language source is already compared, it contains diff, e.g.
     * { __old: value, __new: wert 1 }, if target annotation in other language
     * has other value, it should also reflect the value, be { __old: value,
     * __new: wert 2 }, not { __old: value,  __new: wert 1 }. So we remove the
     * diff completely from value and let it be compared again. Other language
     * source will be empty anyway.
     */
    private getSourceValue(source: any, attribute: string) {
        let value = source._attributes[attribute];
        if (value instanceof Diff) {
            value = value.__old;
        }
        return value;
    }

    /**
     * If the array doesn't have any other annotations to take the values from,
     * we just don't do it and include the annotations from other language as it
     * is. E.g. we include Label but there are no Heading or QuickInfo to take
     * values from. So we just don't do it.
     * @param target where to put the missing item
     * @param property node name
     * @returns true if there are some annotations to take the values from.
     */
    canAccept(target: any[], property: string): boolean {
        return property === "Annotation" && target
            .map(item => item._attributes?.Term)
            .some(term => this.interchangableTerms.includes(term));
    }

    // If one of the terms is missing, its values can be filled by others.
    // Usually Heading or QuickInfo is missing. So we order terms by source
    // priority (take from label first).
    private interchangableTerms = ["SAP__common.Label", "SAP__common.Heading", "SAP__common.QuickInfo"];

    private findByPriority(annotations: any[], index: number) {
        for (const interchangableTerm of this.interchangableTerms) {
            for (const annotation of annotations) {
                if (annotation._attributes?.Term === interchangableTerm &&
                    annotation !== annotations[index]) {
                    return annotation;
                }
            }
        }
    }
}
