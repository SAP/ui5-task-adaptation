import UI5JsonParser from "./ui5MetadataJsonUtil.js";

interface ProcessTermOptions {
    attributesProperty: string;
    entity: string;
    explicitBoolean?: boolean;
}

export default class UI5JsonConverter {
    config: any;
    oAnnotationConfig: any;

    static convertAnnotations(json: any) {
        const annotationsNode = UI5JsonParser.getAnnotationsNode(json);
        if (annotationsNode) {
            return Object.entries(annotationsNode).map(([target, annotations]) =>
                this.processAnnotations(annotations, target));
        }
        return [];
    }

    static processAnnotations(json: any, target: string) {
        const attributes = {
            "_attributes": {
                "Target": this.trimLeft(target, "@")
            }
        }
        const annotation = this.processTerms(json);
        return Object.assign(attributes, annotation);
    }

    private static processObject(term: any, value: any) {
        let wrapped = this.getWrappedProperty(value);
        if (wrapped) {
            this.getAttributes(term)[wrapped.property] = wrapped.value;
        } else {
            const record = this.processTerms(value);
            this.updateToArray(term, "Record", record);
        }
    }

    static processTerms(json: any) {
        let result: any = {};
        const pendingInlineAnnotationKeys = new Array<IInlineAnnotation>();
        for (const key of Object.keys(json)) {
            let wrapped = this.getWrappedProperty(json);
            const inlineAnnotation = this.getInlineAnnotation(key);
            if (inlineAnnotation) {
                pendingInlineAnnotationKeys.push(inlineAnnotation);
                continue;
            }
            if (wrapped) {
                this.getAttributes(result)[wrapped.property] = wrapped.value;
            } else if (key.startsWith("$")) {
                this.getAttributes(result)[this.trimLeft(key, "$")] = json[key];
            } else {
                // Split Annotation from PropertyValue
                const options: ProcessTermOptions = (key[0] === "@") ? {
                    attributesProperty: "Term",
                    entity: "Annotation"
                } : {
                    attributesProperty: "Property",
                    entity: "PropertyValue",
                    explicitBoolean: true
                }
                const term: any = this.createTerm(key, options.attributesProperty);
                const value = json[key];
                if (typeof value === "string") {
                    term._attributes.String = value;
                } else if (typeof value === "boolean" && (!value || options.explicitBoolean)) {
                    term._attributes.Bool = value.toString();
                } else if (typeof value === "number") {
                    term._attributes.Int = value.toString();
                } else if (Array.isArray(value)) {
                    this.processCollection(term, value);
                } else if (typeof value === "object") {
                    this.processObject(term, value);
                }
                this.updateToArray(result, options.entity, term);
            }
        }
        for (const inlineAnnotation of pendingInlineAnnotationKeys) {
            const { term, reference } = inlineAnnotation;

            if (inlineAnnotation.isInlineAnnotationWithCollections) {
                // TODO can possibly be merged with below
                this.processInlineAnnotationWithCollections(inlineAnnotation, json, result);
            } else if (Array.isArray(json[inlineAnnotation.key])) {
                const annotationTerm: any = { Annotation: this.createTerm(term, "Term") };
                this.processCollection(annotationTerm.Annotation, json[inlineAnnotation.key]);
                if (Array.isArray(result[inlineAnnotation.entity])) {
                    let referenced = result[inlineAnnotation.entity].find((item: any) => this.isReferenced(item, inlineAnnotation.attributesProperty, reference));
                    if (referenced) {
                        referenced = Object.assign(referenced, annotationTerm);
                    }
                } else if (result[inlineAnnotation.entity]) {
                    result[inlineAnnotation.entity] = Object.assign(result[inlineAnnotation.entity], annotationTerm);
                }
            } else {
                const annotation = this.processAnnotation(json, inlineAnnotation.key, term);
                if (Array.isArray(result[inlineAnnotation.entity])) {
                    const referenced = result[inlineAnnotation.entity].find((item: any) => this.isReferenced(item, inlineAnnotation.attributesProperty, reference));
                    if (referenced) {
                        referenced.Annotation = annotation;
                    }
                } else if (result[inlineAnnotation.entity]) {
                    result[inlineAnnotation.entity].Annotation = annotation;
                }
            }
        }
        return result;
    }

    private static processInlineAnnotationWithCollections(inlineAnnotation: IInlineAnnotation, json: any, result: any) {
        delete Object.assign(json, { [`@${inlineAnnotation.term}`]: json[inlineAnnotation.key] })[inlineAnnotation.key];
        const term: any = this.createTerm(inlineAnnotation.term, "Term");
        this.processCollection(term, json[`@${inlineAnnotation.term}`]);
        const PropertyValue = (Array.isArray(result.PropertyValue)) ? result.PropertyValue : [result.PropertyValue];
        const targetProperty = PropertyValue.find((propertyValueObject: any) => {
            return this.isReferenced(propertyValueObject, "Property", inlineAnnotation.reference);
        });
        if (targetProperty) {
            this.updateToArray(targetProperty, "Annotation", term);
        }
    }

    private static isReferenced(item: any, attributesProperty: string, reference: string) {
        return this.getAttributes(item) && this.getAttributes(item)[attributesProperty] === reference;
    }

    private static processAnnotation(json: any, key: string, term: string = key) {
        const annotation = this.processTerms(json[key]);
        const annotationTerm = this.trimByAt(term);
        const attributes = this.getAttributes(annotation);
        if (Object.keys(attributes).length > 0 && annotationTerm) {
            annotation._attributes = Object.assign({ "Term": annotationTerm }, attributes);
        } else {
            this.getAttributes(annotation).Term = annotationTerm;
        }
        return annotation;
    }

    private static getInlineAnnotation(key: string) {
        const parts = key.split("@"); // @<ref>@<term>
        if (parts.length === 3) {
            return {
                reference: parts[1],
                term: parts[2],
                key,
                attributesProperty: "Term",
                entity: "Annotation"
            }
        } else if (parts.length === 2 && parts[0]) { // <ref>@<term>
            return {
                reference: parts[0],
                term: parts[1],
                key,
                isInlineAnnotationWithCollections: true,
                attributesProperty: "Property",
                entity: "PropertyValue",
            }
        }
    }

    private static createTerm(key: string, attributesProperty: string) {
        const parts = key.split("#");
        const qualifier = parts.length > 1 && parts.pop();
        const term: any = {
            "_attributes": {
                [attributesProperty]: this.trimByAt(parts[0])
            }
        };
        if (qualifier) {
            term._attributes.Qualifier = qualifier;
        }
        return term;
    }

    private static processCollection(term: any, value: any[]) {
        const collection: any = term.Collection = {};
        for (const item of value) {
            this.processCollectionItem(collection, item);
        }
    }

    private static processCollectionItem(collection: any, item: any) {
        let wrapped = this.getWrappedProperty(item);
        if (wrapped) {
            this.updateToArray(collection, wrapped.property, wrapped.value.length > 0 ? { _text: wrapped.value } : {});
        } else if (typeof item === "string") {
            this.updateToArray(collection, "String", { _text: item });
        } else if (typeof item === "object") {
            this.processObject(collection, item);
        }
    }

    private static updateToArray(object: any, key: string, value: any) {
        if (object[key]) {
            if (!Array.isArray(object[key])) {
                object[key] = [object[key]];
            }
            object[key].push(value);
        } else {
            object[key] = value;
        }
    }

    private static getAttributes(parent: any) {
        if (parent._attributes == null) {
            parent._attributes = {};
        }
        return parent._attributes;
    }

    private static trimLeft(str: string, char: string) {
        while (str.startsWith(char)) {
            str = str.substring(1);
        }
        return str;
    }

    private static trimByAt(term: string) {
        const indexOfAt = term.indexOf("@");
        if (indexOfAt > -1) {
            return term.substring(indexOfAt + 1);
        }
        return term;
    }

    private static isWrapped(type: string | any): boolean | undefined {
        // copied from openUI5 _MetadataConverter.js
        switch (type) {
            case "$AnnotationPath":
            case "$NavigationPropertyPath":
            case "$Path":
            case "$PropertyPath":
            case "$Binary":
            case "$Date":
            case "$DateTimeOffset":
            case "$Decimal":
            case "$Duration":
            case "$Guid":
            case "$TimeOfDay":
            case "$UrlRef":
            case "$EnumMember":
                return true;
        }
    }

    private static getWrappedProperty(item: any): any | undefined {
        if (typeof item === "object") {
            const keys = Object.keys(item);
            if (keys.length === 1 && this.isWrapped(keys[0])) {
                return {
                    property: keys[0].substring(1),
                    value: item[keys[0]]
                }
            }
        }
    }
}

interface IInlineAnnotation {
    reference: string;
    term: string;
    key: string;
    isInlineAnnotationWithCollections?: boolean;
    attributesProperty: string;
    entity: string;
}
