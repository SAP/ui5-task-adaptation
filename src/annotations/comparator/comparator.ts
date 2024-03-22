import { insertInArray, traverse } from "../../util/commonUtil.js";

import AnnotationDiffStructureError from "../../model/annotationDiffStructureError.js";
import DiffCase from "./diffCase.js";
import InterchangableCase from "./interchangableCase.js";
import MetadataJsonUtil from "../converter/metadataJsonUtil.js";
import XmlUtil from "../../util/xmlUtil.js";

export interface IDiffProperty {
    object: any;
    property: string | number;
}


export class Diff {
    __old: string;
    __new: string;

    constructor(__old: string, __new: string) {
        this.__old = __old;
        this.__new = __new;
    }

    toString() {
        return `{ __old: ${this.__old},  __new: ${this.__new} }`;
    }
}


export interface DiffJson {
    json: any;
    properties: Set<IDiffProperty>;
}


export default class Comparator {

    private diffs = new Set<IDiffProperty>();
    private xml_a: string;
    private xml_b: string;

    constructor(xml_a: string, xml_b: string) {
        this.xml_a = xml_a;
        this.xml_b = xml_b;
    }

    compare(): DiffJson {
        const json_a = typeof this.xml_a === "string" ? XmlUtil.xmlToJson(this.xml_a) : this.xml_a;
        const json_b = typeof this.xml_b === "string" ? XmlUtil.xmlToJson(this.xml_b) : this.xml_b;
        const scheme_a = MetadataJsonUtil.getSchemaNode(json_a);
        const scheme_b = MetadataJsonUtil.getSchemaNode(json_b);
        if (scheme_a && scheme_b) {
            // we compare only Annotations, other types are left as it is
            this.traverseCompare(scheme_a, scheme_b, "Annotations");
        }
        return {
            json: json_a,
            properties: this.diffs
        }
    }

    private traverseCompare(obj_a: any, obj_b: any, property: string | number) {
        let a = obj_a[property];
        let b = obj_b[property];
        if (typeof a === "object" && !(a instanceof Diff) && typeof b !== "object" ||
            typeof b === "object" && !(b instanceof Diff) && typeof a !== "object" ||
            a == null || b == null) {
            // When during traversing we end up in primitives like string, we
            // compare the values. If one of them is not primitive or oone of
            // them is undefined, we throw exception (see test 06, 07).
            throw new AnnotationDiffStructureError({ a, b });
        } else if (typeof a !== "object" && typeof b !== "object") {
            // If primitive values are not same - we assume they are
            // translations, so we save them.
            if (a !== b) {
                obj_a[property] = new Diff(a, b);
                this.diffs.add({ object: obj_a, property });
            }
        } else {
            a = this.arrayIfNeeded(obj_a, obj_b, property);
            b = this.arrayIfNeeded(obj_b, obj_a, property);
            if (Array.isArray(a)) {
                let idProperty = this.getIdProperty(property);
                if (idProperty) {
                    this.traverseById(a, b, idProperty, property);
                } else {
                    for (let i = 0; i < Math.max(a.length, b.length); i++) {
                        if (a[i] && b[i]) {
                            this.traverseCompare(a, b, i);
                        } else {
                            // If the number of items of nodes without id are
                            // different, we throw error (see test 08).
                            throw new AnnotationDiffStructureError({ a, b });
                        }
                    }
                }
            } else {
                for (const key of Object.keys(a)) {
                    this.traverseCompare(a, b, key);
                }
            }
        }
    }

    /**
     * If one language annotation has one property it is an object, if other
     * language same annotation consists of multiple properties, we need to
     * equal them, so they are both arrays (see test 01-04).
     */
    private arrayIfNeeded(obj_a: any, obj_b: any, property: string | number) {
        if (!Array.isArray(obj_a[property])) {
            // If node with id - make array anyway, so it's easier to compare (see test 04).
            if (simpleIdentifiers.has(property) || Array.isArray(obj_b[property])) {
                obj_a[property] = [obj_a[property]];
            }
        }
        return obj_a[property];
    }


    /**
     * If some node (Annotations, Annotation, PropertyValue, LabeledElement) has
     * an id, we can compare by id, so the items order doesn't matter anymore.
     * @param a array of nodes with id of one language
     * @param b array of nodes with id of the other language
     * @param idProperty property which value is an id (e.g. Target="<unique-id>")
     * @param property node name (Annotations, Annotation, PropertyValue, ...)
     */
    private traverseById(a: any[], b: any[], idProperty: string, property: string | number): void {
        if (typeof property !== "string") {
            return;
        }
        let items_a = new Items(a, idProperty);
        let items_b = new Items(b, idProperty);
        const includer_a = new Includer(a, property);
        const includer_b = new Includer(b, property);
        for (let i = 0; i < Math.max(a.length, b.length); i++) {
            // There might be an exceptional case, when the object doesn't
            // contain attributes. In this case we continue traversing, like
            // UI5 does.
            const id_a = a[i]?._attributes?.[idProperty];
            const id_b = b[i]?._attributes?.[idProperty];
            if (id_a !== id_b) {
                // We go down the array and if suddenly the ids for comparing
                // items are not the same, we need to find the item with the
                // same id if it exists.
                if (items_b.has(id_a) && items_a.has(id_b)) {
                    // If we found the item with the same id, we swap places
                    // with current item (see test 05).
                    items_b.swap(id_a, i);
                } else if (!items_a.has(id_b) && id_b) {
                    // If 1st language missing the item, include it from 2nd (see test 02).
                    includer_a.include(b, i);
                } else if (!items_b.has(id_a) && id_a) {
                    // If 2nd language missing the item, include it from 1st (see test 03).
                    includer_b.include(a, i);
                }
            }
            this.traverseCompare(a, b, i);
        }
    }

    /**
     *  Some nodes, like Annotations, Annotation, PropertyValue have unique id
     *  among other same nodes. We can use it to know what to compare with what
     *  even if the order is different. IdProperty is a property name of that id,
     *  e.g. for Annotations it will be Target (like in
     *  Target="<some-unique-id>").
     *  @param property node which might have an id: Annotations, PropertyValue
     *  @return the property name which represents id: Target, Property
     */
    private getIdProperty(property: string | number): string | undefined {
        return simpleIdentifiers.get(property);
    }
}


class Includer {

    private ALL_DIFF_CASES = [
        new InterchangableCase()
    ];

    private diffCases = new Array<DiffCase>();
    private shouldClear: boolean;
    private target: any[];
    private property: string;

    /**
     * It will decide what to do with the item missing in one language.
     * @param target an array which might miss the item
     * @param property the node name needed to decide how to include the missing
     * item in array
     * @param shouldClear if the item is missing and it's not Label or QuickInfo
     * or Heading, we clear all the properties except Ids, so in i18n.properties
     * they will have empty values. Because we don't know what should be there.
     */
    constructor(target: any[], property: string, shouldClear: boolean = true) {
        this.shouldClear = shouldClear;
        this.target = target;
        this.property = property;
        for (const diffCase of this.ALL_DIFF_CASES) {
            if (diffCase.canAccept(target, property)) {
                this.diffCases.push(diffCase);
            }
        }
    }


    /**
     * If in some language some array missing the item, we include the missing
     * item from other language array with the same id.
     * @param source the item from other language array that is missed in target
     * @param index here to put it in the array
     */
    include(source: any[], index: number) {
        // Insert node with empty value (see test 02) if missing in default
        // language or default language value if missing in other language
        // (see test 03).
        const clone = Includer.cloneAndClear(source[index], this.shouldClear);
        insertInArray(this.target, index, clone);
        // Some annotations like Label, QuickInfo or Heading are
        // interchangable so if QuickInfo is missing we can copy the value
        // from Label or Heading (see test 01).
        for (const diffCase of this.diffCases) {
            diffCase.accept(this.target, index, this.property);
        }
    }

    /**
     * if the item is missing in default language, and it's not Label or
     * QuickInfo or Heading, we clear all the properties except Ids, so in
     * i18n.properties they will have empty values. Because we don't know what
     * should be there. But if the item is missing in language other than
     * default, we include the copy of item from default language and not
     * clearing them (see test 02, 04).
     */
    private static cloneAndClear(obj: any, shouldClear: boolean = true) {
        const clone = structuredClone(obj);
        if (shouldClear) {
            traverse(clone, [], (json: any, key: string | number) => {
                if (typeof key !== "string" || !simpleIdentifiersReversed.has(key)) {
                    json[key] = "";
                }
            });
        }
        return clone;
    }
}


class Items {
    private idProperty: string;
    private array: any[];
    private objectMap: Map<string, any> | null = null;

    /**
     * Map of id per item which is lazy initialized if needed
     * @param array
     * @param idProperty
     */
    constructor(array: any[], idProperty: string) {
        this.array = array;
        this.idProperty = idProperty;
    }

    /**
     * Find the item with by id and swap their places.
     * @param id of the item which seems like not in the place it should be
     * @param newIndex new place where the item should actually be
     */
    swap(id: string, newIndex: number) {
        const oldIndex = this.initMap().get(id);
        const temp = this.array[newIndex];
        this.array[newIndex] = this.array[oldIndex];
        this.array[oldIndex] = temp;
        this.initMap(true);
    }

    has(idProperty: string) {
        return this.initMap().has(idProperty);
    }

    get(idProperty: string) {
        return this.array[this.initMap().get(idProperty)];
    }

    /**
     * Lazy init the map only if the order of items are messed up, which
     * actually an eexception, so will make it lazy way.
     * @param force force to update.
     * @returns the map id per item index.
     */
    private initMap(force: boolean = false) {
        if (this.objectMap == null || force) {
            this.objectMap = new Map(this.array.map((item: any, index) => [item._attributes[this.idProperty], index]));
        }
        return this.objectMap;
    }
}


class Identifiers extends Map<string, string> {
    has(property: string | number): boolean {
        return typeof property === "string" && super.has(property);
    }

    get(property: string | number): string | undefined {
        return typeof property === "string" ? super.get(property) : undefined;
    }
}

// According to OData schema some nodes MUST have the ids, by these nodes the
// property which contains the id is named differently as you can see.
const simpleIdentifiers = new Identifiers([
    ["Annotations", "Target"],
    ["Annotation", "Term"],
    ["LabeledElement", "Name"],
    ["PropertyValue", "Property"]
]);


const simpleIdentifiersReversed = new Identifiers([...simpleIdentifiers].map(([name, idProperty]) => [idProperty, name]));
