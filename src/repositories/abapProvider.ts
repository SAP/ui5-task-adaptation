import { createAbapServiceProvider } from "@sap-ux/system-access";
import type { AbapServiceProvider } from "@sap-ux/axios-extension";
import { IConfiguration } from "../model/types.js";
import { getLogger } from "@ui5/logger";
import AbapValidator from "../util/validator/abapValidator.js";

const log = getLogger("@ui5/task-adaptation::AbapProvider");
log.debug = (message: string) => log.verbose(message);

export default class AbapProvider {

    private provider: AbapServiceProvider | null = null;
    private abapValidator = new AbapValidator();

    async get({ target, destination }: IConfiguration): Promise<AbapServiceProvider> {
        if (!this.provider) {
            const abapTarget = this.abapValidator.validateAndGetAbapTarget(target, destination);
            if (abapTarget) {
                this.provider = await createAbapServiceProvider(abapTarget, { ignoreCertErrors: abapTarget.ignoreCertErrors }, true, log);
            }
        }
        if (!this.provider) {
            throw new Error("Target should be specified in ui5.yaml configuration to connect the ABAP system");
        }
        return this.provider;
    }
}
