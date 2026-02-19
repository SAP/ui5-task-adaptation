import { ManifestUpdateCommand } from "./command.js";
import { get } from "../../util/objectPath.js";
import { IAppVariantIdHierarchyManifestItem } from "../../model/appVariantIdHierarchyItem.js";
import { getLogger } from "@ui5/logger";

const log = getLogger("@ui5/task-adaptation::ApplyDescriptorChangesCommand");

export default class AddAppVariantIdHierarchyLayerCommand extends ManifestUpdateCommand {
    constructor(private appVariantIdHierarchyItem: IAppVariantIdHierarchyManifestItem) {
        super();
    }

    async execute(manifest: any): Promise<void> {
        log.verbose(`Adding app variant ID hierarchy item for app variant ${this.appVariantIdHierarchyItem.appVariantId} to manifest`);
        get(manifest, ["sap.ui5", "appVariantIdHierarchy"], [] as IAppVariantIdHierarchyManifestItem[])
            .unshift(this.appVariantIdHierarchyItem);
    }
}
