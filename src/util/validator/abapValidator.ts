import { IConfiguration, LandscapeType } from "../../model/configuration.js";
import IValidator from "./validator.js";
import { getLogger } from "@ui5/logger";

const log = getLogger("@ui5/task-adaptation::AbapValidator");

export default class AbapValidator implements IValidator {
    public type: LandscapeType = "abap";

    validateConfiguration({ destination, target }: IConfiguration) {
        if (!destination && !target) {
            throw new Error("'target' should be specified in ui5.yaml configuration");
        } else if (destination && !target) {
            log.warn("Destination is deprecated, use target/destination configuration instead");
        }
    }
}
