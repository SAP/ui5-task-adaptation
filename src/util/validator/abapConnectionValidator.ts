import { AbapTarget } from "@sap-ux/system-access";
import { IAbapTargetMeta } from "../../model/configuration.js";
import { validateObject } from "../commonUtil.js";
import { isAppStudio } from "@sap-ux/btp-utils";
import { getLogger } from "@ui5/logger";

const log = getLogger("@ui5/task-adaptation::AbapConnectionValidator");

export default class AbapConnectionValidator {
    validateAndGetAbapTarget(target: AbapTarget & IAbapTargetMeta | undefined, destination: string | undefined) {
        if (target) {
            // if target configuration appears, we validate that it should be
            // either target/destination for BAS or target/url for IDE we're
            // trying to detect is it destination for BAS or url for IDE
            const abapTargetProperties: Array<keyof AbapTarget> = isAppStudio() ? ["destination"] : ["url"];
            validateObject(target, abapTargetProperties, "should be specified in ui5.yaml configuration/target");
            return target;
        } else if (destination) {
            log.warn("Destination is deprecated, use target/destination configuration instead");
            return { destination };
        }
        throw new Error("Target should be specified in ui5.yaml configuration to connect the ABAP system");
    }
}
