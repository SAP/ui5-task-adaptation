import * as jsonDiff from "json-diff";

import AnnotationDiffStructureError from "../model/annotationDiffStructureError";

export interface IJsonContent {
    language: string;
    json: any;
}

export interface IDiffProperty {
    object: any;
    property: string;
}

export interface IDiffJson {
    json: any;
    properties: Set<IDiffProperty>;
}

export default class JsonDiffUtil {

    static diff(jsonA: any, jsonB: any): IDiffJson {
        const json = jsonDiff.diff(jsonA, jsonB, { full: true, sort: false });
        const properties = this.findDiffsAndRestoreStructure(json);
        return {
            json,
            properties
        }
    }


    private static findDiffsAndRestoreStructure(object: any) {
        const properties = new Set<IDiffProperty>();
        this.traverseDiffRecursive(properties, { object }, "object");
        return properties;
    }


    private static traverseDiffRecursive(properties: Set<IDiffProperty>, object: any, property: any) {
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
                        this.traverseDiffRecursive(properties, item, 1);
                    } else if (item[0] === "+" || item[0] === "-") {
                        throw new AnnotationDiffStructureError(item[1]);
                    }
                }
            }
        } else {
            for (const key of Object.keys(current)) {
                if (key == "__old" || key == "__new") {
                    properties.add({ object, property });
                    break;
                } else {
                    this.traverseDiffRecursive(properties, current, key);
                }
            }
        }
    }

}