import * as jsonDiff from "json-diff";

import AnnotationDiffStructureError from "../model/annotationDiffStructureError";
import Language from "../model/language";

export interface IJsonContent {
    language: Language;
    json: any;
}

export interface IDiffProperty {
    object: any;
    property: string | number;
    type: DiffTypeEnum
}

export enum DiffTypeEnum {
    MINUS,
    PLUS,
    DELTA
}

export interface IDiffJson {
    json: any;
    properties: Set<IDiffProperty>;
}

export interface IDiffOptions {
    restoreOriginalValue: boolean;
    throwErrorOnDiffStructure: boolean;
}

export default class JsonDiffUtil {

    static diff(jsonA: any, jsonB: any, options: IDiffOptions = {
        throwErrorOnDiffStructure: true,
        restoreOriginalValue: false
    }): IDiffJson {
        const json = jsonDiff.diff(jsonA, jsonB, { full: true, sort: false });
        const properties = this.findDiffsAndRestoreStructure(json, options);
        return {
            json,
            properties
        }
    }


    private static findDiffsAndRestoreStructure(object: any, options: IDiffOptions) {
        const properties = new Set<IDiffProperty>();
        this.traverseDiffRecursive(properties, { object }, "object", options);
        return properties;
    }


    private static traverseDiffRecursive(properties: Set<IDiffProperty>, object: any, property: any, options: IDiffOptions) {
        const current = object[property];
        if (typeof current !== "object") {
            return;
        }
        if (Array.isArray(current)) {
            for (let i = 0; i < current.length; i++) {
                const item = current[i];
                if (["~", " ", "-", "+"].some(sign => item[0] === sign)) {
                    current[i] = item[1];
                    // This is a sign from json-diff plugin, that the property contains differences.
                    // We will remove these signs, to restore the original structure
                    if (item[0] === "~") {
                        this.traverseDiffRecursive(properties, item, 1, options);
                    } else if (item[0] === "+" || item[0] === "-") {
                        if (options.throwErrorOnDiffStructure) {
                            throw new AnnotationDiffStructureError(item[1]);
                        }
                        properties.add({
                            object: object[property],
                            property: i,
                            type: item[0] === "+" ? DiffTypeEnum.PLUS : DiffTypeEnum.MINUS
                        });
                    }
                }
            }
        } else {
            for (const key of Object.keys(current)) {
                if (key == "__old" || key == "__new") {
                    if (options.restoreOriginalValue) {
                        object[property] = current["__old"];
                    }
                    properties.add({ object, property, type: DiffTypeEnum.DELTA });
                    break;
                } else {
                    this.traverseDiffRecursive(properties, current, key, options);
                }
            }
        }
    }

}