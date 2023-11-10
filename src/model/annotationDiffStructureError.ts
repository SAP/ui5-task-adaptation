export default class AnnotationDiffStructureError extends Error {
    constructor(json: any) {
        super(JSON.stringify(json));
    }
}