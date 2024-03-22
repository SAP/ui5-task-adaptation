import { URI } from "../../dist/bundle.js";

export default class UrlUtil {

    static join(relativeUrl: string, parentUrl: string) {
        // Remove trailing slash, otherwise url join can be incorrect Remove
        // trailing slash, otherwise url join can be incorrect Annotation URLs
        // defined in manifest might end with .../$value/ or .../$value and both
        // are accepted by Gateway and produce the same content with same
        // relative URLs. The first case is actually incorrect and we have to
        // sanitize the same way as UI5. We also trim urls domain/host, because
        // we need to substitute it with destination to download later.
        return new URI(relativeUrl).absoluteTo(parentUrl.replace(/\/$/, "")).toString();
    }

    static getResourcePath(url: string) {
        // Trim urls domain/host.
        return URI.parse(url).path;
    }

}
