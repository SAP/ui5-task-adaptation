export default class AnnotationDiffStructureError extends Error {
    constructor(json: any) {
        super(JSON.stringify(json));
        this.name = "AnnotationDiffStructureError";
        this.message = `The structure of the OData annotation xml is different near element: ${JSON.stringify(json)}`;
    }
}
