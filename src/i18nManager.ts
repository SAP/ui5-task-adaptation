import Comparator, { IDiffProperty } from "./annotations/comparator/comparator.js";
import { IJsonPerLanguage, IJsonPromisePerLanguage } from "./model/types.js";

import AnnotationDiffStructureError from "./model/annotationDiffStructureError.js";
import Language from "./model/language.js";
import { getUniqueName } from "./util/commonUtil.js";
import { join } from "path/posix"; // Ensure standardized dir separators to ensure Windows compatibility
import { slugify } from "transliteration";

// To generate keys, english language is more common, so compare all other
// languages with it


export class PropertyValue {
    public value: string;
    public isReference: boolean = false;
    public qualifier: string;
    public language: Language;

    private static OLD = "__old";
    private static NEW = "__new";

    private constructor(qualifier: string, language: Language, value: string) {
        this.qualifier = qualifier;
        this.language = language;
        this.value = value;
    }

    get isOld() {
        return this.qualifier === PropertyValue.OLD;
    }

    set(diff: any, references: Map<string, string>) {
        this.value = diff[this.qualifier];
        this.isReference = references.has(diff[this.qualifier]);
    }

    static oldFrom(language: Language, value: string = "") {
        return new PropertyValue(PropertyValue.OLD, language, value);
    }

    static newFrom(language: Language, value: string = "") {
        return new PropertyValue(PropertyValue.NEW, language, value);
    }
}

export class I18nFileContent {
    private properties = new Map<Language, Map<string, string>>();

    constructor(languages: Language[]) {
        languages.forEach(language => this.properties.set(language, new Map<string, string>()));
    }

    add(prop: PropertyValue, key: string) {
        this.getOrCreateLanguageContent(prop.language).set(key, prop.value);
        this.initKeyValuesForOtherLanguages(prop, key);
    }

    private initKeyValuesForOtherLanguages(prop: PropertyValue, key: string) {
        // "", EN, EN_US, DE, FR
        // If we already compared 2 languages and saved translations, we assume
        // that we have generated all property keys, but suddenly 3d language or
        // further contain translation which was not present in previous
        // languages we need to update all other languages then. These values
        // will be overwritten later by actual values of the language:
        // this.getOrCreateLanguageContent(prop.language).set(key, prop.value);
        if (prop.isOld) {
            this.properties.forEach((keyValue, language) => {
                if (language !== prop.language && !keyValue.has(key)) {
                    keyValue.set(key, prop.value);
                }
            });
        }
    }

    hasTranslations() {
        // this.properties.size can be 0 or 2+, it can't be 1
        return [...this.properties.values()].some(keyValue => keyValue.size > 0);
    }

    private getOrCreateLanguageContent(language: Language) {
        if (!this.properties.has(language)) {
            this.properties.set(language, new Map<string, string>());
        }
        return this.properties.get(language)!;
    }

    createFiles(i18nPathName: string) {
        const files = new Map<string, string>();
        if (this.hasTranslations()) {
            this.properties.forEach((i18nLines, language) => {
                if (language.isDefault) {
                    createI18nFile("i18n", i18nLines);
                }
                createI18nFile("i18n_" + language.i18n, i18nLines);
            });
        }
        return files;

        function createI18nFile(filename: string, i18nLines: Map<string, string>) {
            const filepath = join(i18nPathName, filename + ".properties");
            files.set(filepath, [...i18nLines].map(([key, value]) => `${key}=${value}`).toSorted().join("\n"));
        }
    }
}

export default class I18nManager {

    private modelName: string;
    private appVariantId: string;
    private references = new Map<string, string>();
    private existingKeys = new Set<string>();
    private i18nFileContent: I18nFileContent;

    constructor(modelName: string, appVariantId: string, languages: Language[]) {
        this.modelName = modelName;
        this.appVariantId = appVariantId;
        this.i18nFileContent = new I18nFileContent(languages);
    }

    processDiff(properties: Set<IDiffProperty>, previousLanguage: Language, currentLanguage: Language) {
        // json-diff uses __old and __new value as diff,
        // so we assign it with languages which were in comparison
        const propertyValues: PropertyValue[] = [
            PropertyValue.oldFrom(previousLanguage),
            PropertyValue.newFrom(currentLanguage)
        ];
        for (const property of properties) {
            this.replaceWithModelReference(property, propertyValues);
        }
    }

    createFiles(i18nPathName: string) {
        return this.i18nFileContent.createFiles(i18nPathName);
    }

    async populateTranslations(annotationJsons: Map<Language, Promise<any>>): Promise<IJsonPromisePerLanguage> {
        /* We compare annotations. Diff gives us:
        {
            "string": {
                "__old": "A"
                "__new": "B"
            }
        }
        we generate key and extract to properties file. Now it looks so:
        {
            "string": "{@i18n>id_KEY}"
        }
        and we compare this with next language and diff gives us:
        {
            "string": {
                "__old": "{@i18n>id_KEY}"
                "__new": "C"
            }
        }
        we use already generate key id_KEY and extract translation value to
        properties file again. And then compare with the next language and so on
        and so on */
        let defaultAnnotation = I18nManager.extractDefaultLanguageAnnotation(annotationJsons);
        if (defaultAnnotation && annotationJsons.size > 0) {
            defaultAnnotation = await this.populate([...annotationJsons], defaultAnnotation);
        }
        return defaultAnnotation;
    }

    async populate(annotationJsons: [Language, Promise<any>][], defaultAnnotation: IJsonPerLanguage) {
        let p = defaultAnnotation;
        for (const c of annotationJsons.map(([language, json]) => ({ language, json }))) {
            try {
                const comparator = new Comparator(await p.json, await c.json);
                const pDiff = comparator.compare();
                this.processDiff(pDiff.properties, p.language, c.language);
                p.json = pDiff.json;
            } catch (error) {
                if (error instanceof AnnotationDiffStructureError) {
                    throw new Error(`The structure of the OData annotation xml of language '${p.language}' is different from xml of language '${c.language}' near element: ${error.message}`);
                }
                throw error;
            }
        }
        return p;
    }

    static extractDefaultLanguageAnnotation(annotationJsons: Map<Language, Promise<any>>): IJsonPromisePerLanguage {
        for (const [language, json] of annotationJsons) {
            if (language.isDefault) {
                annotationJsons.delete(language);
                return { json, language };
            }
        }
        const language = [...annotationJsons.keys()][0];
        let json = annotationJsons.get(language)!;
        annotationJsons.delete(language);
        return { json, language };
    }

    private replaceWithModelReference({ object, property }: IDiffProperty, propertyValues: PropertyValue[]) {
        const diff = object[property];
        this.initPropertyValues(diff, propertyValues);
        // If there are already generated key, like on step 3. above comment, we
        // take it (from __old), so we don't need to generate new
        const propReference = propertyValues.find(prop => prop.isReference);
        let reference = propReference?.value ?? this.createReference(diff.__old);
        object[property] = reference;
        // Other values, which are not references, are extracted to .properties
        const key = this.references.get(reference);
        if (key) {
            propertyValues.filter(prop => !prop.isReference).forEach(prop => this.i18nFileContent.add(prop, key));
        }
    }

    private createReference(value: string) {
        const key = this.appVariantId + "_" + this.getUniqueKeyForValue(value);
        const reference = `{${this.modelName}>${key}}`;
        this.references.set(reference, key);
        return reference;
    }

    getUniqueKeyForValue(value: string) {
        if (typeof value !== "string") {
            throw new Error("Failed to create unique key from: " + JSON.stringify(value));
        }
        const propertyName = slugify(value, { separator: "_", uppercase: true }).replace(/\W/gi, "_");
        const key = getUniqueName([...this.existingKeys.keys()], propertyName);
        this.existingKeys.add(key);
        return key;
    }


    hasTranslations() {
        return this.i18nFileContent.hasTranslations();
    }

    private initPropertyValues(diff: any, propertyValues: PropertyValue[]) {
        propertyValues.forEach(prop => prop.set(diff, this.references));
    }

}