import BuildStrategy from "../../buildStrategy.js";
import { AppDescriptorChange, RawApplier, RegistrationBuild } from "../../../dist/bundle.js";
import { ManifestUpdateCommand } from "./command.js";
import { IChange } from "../../model/types.js";
import { getLogger } from "@ui5/logger";

const log = getLogger("@ui5/task-adaptation::ApplyDescriptorChangesCommand");

export default class ApplyDescriptorChangesCommand extends ManifestUpdateCommand {
    constructor(private manifestChanges: ReadonlyArray<IChange>, private prefix: string) {
        super();
    }

    async execute(manifest: any): Promise<void> {
        await this.applyDescriptorChanges(manifest);
    }

    private async applyDescriptorChanges(baseAppManifest: any) {
        log.verbose("Applying appVariant changes");
        const changesContent = new Array<AppDescriptorChange>();
        const i18nBundleName = this.prefix;
        for (const change of this.manifestChanges) {
            this.adjustAddNewModelEnhanceWith(change, i18nBundleName);
            changesContent.push(new AppDescriptorChange(change));
        }
        if (changesContent.length > 0) {
            const changeHandlers = await Promise.all(changesContent.map(change => RegistrationBuild[change.getChangeType()]()));
            await RawApplier.applyChanges(changeHandlers, baseAppManifest, changesContent, new BuildStrategy());
        }
    }

    private adjustAddNewModelEnhanceWith(change: IChange, i18nBundleName: string) {
        if (change.changeType === "appdescr_ui5_addNewModelEnhanceWith") {
            if (change.texts == null) {
                // We need to add texts properties to changes because not all
                // have texts property. Changes without texts property can
                // causes issues in bundle.js This is needed for now, and will
                // be removed as soon as change merger in openUI5 is updated
                change.texts = { i18n: change.content?.bundleUrl || "i18n/i18n.properties" };
            }
            change.texts.i18n = i18nBundleName + "/" + change.texts.i18n;
        }
    }
}
