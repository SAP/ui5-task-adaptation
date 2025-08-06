const DEFAULT_LANGUAGE = "en";

export default class Language {
    readonly sap: string;
    readonly i18n: string;
    isDefault: boolean;

    constructor(sap: string, i18n: string, isDefault: boolean = false) {
        this.sap = sap;
        this.i18n = i18n;
        this.isDefault = isDefault;
    }

    /**
     * Create a language array from languages in configuration and default language.
     * @param languages Typically an array of objects. Probably could be undefined.
     * @returns An array of type Language, where the default language is placed first,
     * followed by the passed config languages.
     */
    static create(languages: any[] | undefined): Language[] {
        let configLanguages: Language[] = [];
        if (languages !== undefined) {
            configLanguages = languages.map(item => {
                if (typeof item === "string") {
                    // For legacy language format support which is just a string and doesn't contain i18n
                    return new Language(item, item.toLowerCase());
                } else if (item.sap !== undefined && item.i18n !== undefined) {
                    return new Language(item.sap, item.i18n);
                } else {
                    throw new Error("Can not parse languages from ui5.yaml configuration. Please use the 'AdaptationProject: Create wizard' to generate the project.");
                }
            });
        }
        let defaultLanguage = configLanguages.find(language => language.sap.toLowerCase() === DEFAULT_LANGUAGE) ?? configLanguages[0];
        if (defaultLanguage) {
            defaultLanguage.isDefault = true;
        } else {
            return [new Language(DEFAULT_LANGUAGE.toUpperCase(), DEFAULT_LANGUAGE, true), ...configLanguages];
        }
        return configLanguages;
    };
}