import MetadataJsonUtil, { MetadataReference } from "../converter/metadataJsonUtil";
import Transformer, { TransformerInput } from "../transformers/transformer";

import DataSourceODataAnnotation from "../dataSource/dataSourceODataAnnotationBeta";
import UrlUtil from "../../util/urlUtil";

export default class TraverseReferences implements Transformer {

    private metadataUrl?: string;

    constructor(metadataUrl?: string) {
        this.metadataUrl = metadataUrl;
    }

    async transform({ json, language, serviceRequestor, uri: parentUrl }: TransformerInput): Promise<void> {
        const references = MetadataJsonUtil.getReferences(json).filter(TraverseReferences.isTraversable);
        const promises = [];
        for (const { includes, uri: relativeUrl } of references) {
            const absoluteUrl = UrlUtil.join(UrlUtil.getResourcePath(relativeUrl), parentUrl);
            if (this.shouldIgnoreUrl(absoluteUrl, [parentUrl, this.metadataUrl])) {
                // If reference to metadata or its parent, don't traverse
                continue;
            }
            const name = includes[0]?.namespace;
            const dataSource = new DataSourceODataAnnotation(name, absoluteUrl, {}, this.metadataUrl);
            promises.push(dataSource.downloadAnnotation(language, serviceRequestor)
                .then(childAnnotation => ({ name, childAnnotation })));
        }
        const childAnnotations = await Promise.all(promises);
        for (const { childAnnotation } of childAnnotations) {
            this.mergeAnnotations(json, childAnnotation);
        }
        return json;
    }


    private shouldIgnoreUrl(referenceUrl: string, urlsToIgnore: Array<string | undefined>) {
        const toResourcePath = (url: string | undefined) => UrlUtil.getResourcePath(url);
        const isEqual = (a?: string, b?: string) => a && b && a.toLowerCase() === b.toLowerCase();
        return urlsToIgnore.map(toResourcePath).some(url => isEqual(referenceUrl, url));
    }


    private mergeAnnotations(parentJson: any, nestedJson: any) {
        const parentAnnotations = MetadataJsonUtil.getAnnotations(parentJson);
        const parentMapByTarget = MetadataJsonUtil.mapAnnotationsPerTarget(parentJson);
        const nestedMapByTarget = MetadataJsonUtil.mapAnnotationsPerTarget(nestedJson);
        for (const nested of [...nestedMapByTarget].map(([target, { json }]) => ({ target, json }))) {
            // If we found parent annotation with the same target - we extend it
            // with missing <Annotation> nodes. If not, just add it to the end.
            // Annotations do not have a merge logic If same target & term is in
            // parent and nested, parent wins (same logic as UI5 in
            // sap/ui/model/odata/v4/ODataMetaModel.js mergeAnnotations).
            const parent = parentMapByTarget.get(nested.target);
            if (parent) {
                MetadataJsonUtil.toArrayTransform(parent.json, "Annotation");
                const parentTerms = parent.json.Annotation.map((item: any) => item._attributes.Term);
                for (const nestedAnnotation of MetadataJsonUtil.toArrayReadOnly(nested.json.Annotation)) {
                    if (!parentTerms.includes(nestedAnnotation._attributes.Term)) {
                        parent.json.Annotation.push(nestedAnnotation);
                    }
                }
            } else {
                parentAnnotations.push(nested.json);
            }
        }
        MetadataJsonUtil.setAnnotations(parentJson, parentAnnotations);
    }

    private static isTraversable(reference: MetadataReference) {
        const IGNORED_NAMESPACES = ["com.sap.vocabularies.", "Org.OData."];
        return !reference.includes.some(include => IGNORED_NAMESPACES.some(namespace => include.namespace.startsWith(namespace)));
    }

}
