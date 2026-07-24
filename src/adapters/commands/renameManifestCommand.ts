import { ManifestUpdateCommand } from "./command.js";
import { renameJson } from "../../util/renamingUtil.js";
import { getSAPUI5DependencyIds } from "../../util/manifestUtil.js";
import ManifestRenamingHandler from "../../util/renamingHandlers/manifestRenamingHandler.js";

/**
 * Renames app variant references (base app id -> app variant id) inside the
 * manifest.json object. This is the manifest scoped counterpart of
 * {@link RenameFilesCommand}: it operates on the parsed manifest object rather
 * than the raw file map, so it slots into the {@link ManifestUpdateCommandChain}
 * alongside the other manifest updates instead of running as a post step.
 */
export default class RenameManifestCommand extends ManifestUpdateCommand {

    constructor(private references: Map<string, string>, private ignoreInStrings: string[] = []) {
        super();
    }

    async execute(manifest: any): Promise<void> {
        const renamingHandler = new ManifestRenamingHandler();
        renamingHandler.snapshot(manifest);
        const ignoreInStrings = [
            ...this.references.values(),
            ...this.ignoreInStrings,
            ...getSAPUI5DependencyIds(manifest)
        ];
        renameJson(manifest, this.references, ignoreInStrings);
        renamingHandler.restore(manifest);
    }
}
