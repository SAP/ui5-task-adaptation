import AddLibrary from "sap/ui/fl/apply/_internal/changes/descriptor/ui5/AddLibrary";
import SetTitle from "sap/ui/fl/apply/_internal/changes/descriptor/app/SetTitle";
import ChangeCard from "sap/ui/fl/apply/_internal/changes/descriptor/ovp/ChangeCard";
import AddNewCard from "sap/ui/fl/apply/_internal/changes/descriptor/ovp/AddNewCard";
import DeleteCard from "sap/ui/fl/apply/_internal/changes/descriptor/ovp/DeleteCard";
import AddNewObjectPage from "sap/suite/ui/generic/template/manifestMerger/AddNewObjectPage";
import ChangePageConfiguration from "sap/suite/ui/generic/template/manifestMerger/ChangePageConfiguration";
var Registration = {
  appdescr_ui5_addLibraries: AddLibrary,
  appdescr_app_setTitle: SetTitle,
  appdescr_ovp_changeCard: ChangeCard,
  appdescr_ovp_addNewCard: AddNewCard,
  appdescr_ovp_removeCard: DeleteCard,
  appdescr_ui_generic_app_addNewObjectPage: AddNewObjectPage,
  appdescr_ui_generic_app_changePageConfiguration: ChangePageConfiguration
};
export default Registration;
