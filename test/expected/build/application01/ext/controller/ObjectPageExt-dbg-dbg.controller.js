/*
 * Copyright (C) 2009-2025 SAP SE or an SAP affiliate company. All rights reserved.
 */

sap.ui.define([
		"sap/ui/base/Object",
		"sap/ui/model/json/JSONModel",
		"sap/m/ListKeyboardMode"
	], function (
		Parent,
		JSONModel,
		ListKeyboardMode
	) {
		"use strict";
		var CONTROLLER_NAME = "customer.application01.ext.controller.ObjectPageExt";
		var CREATE_BUTTON_ID = "customer.application01::sap.suite.ui.generic.template.ObjectPage.view.Details::C_BankChainHeaderTP--ITEMFACET::addEntry";
		
		function createViewModel() {
			return new JSONModel({
				canCreateItem: true
			});
		}
		
		var Controller = Parent.extend(CONTROLLER_NAME, {

			onInit: function () {
				this.extensionAPI.attachPageDataLoaded(this._attachPageDataLoaded.bind(this));

				var smartFieldAccount = this.getView().byId(
					"DETAIL::BkChnAcctNmbrAtRcpntBkForEdit::Field");
				var smartFieldCountryKey = this.getView().byId(
					"DETAIL::BkChnCntryKeyOfRcpntBkForEdit::Field");
				var smartFieldBankKey = this.getView().byId(
					"DETAIL::BkChnBkKeyOfRcpntBkForEdit::Field");
				var smartFieldIBAN = this.getView().byId(
					"DETAIL::IBAN::Field");
				
				smartFieldAccount.setEnabled(false);
				smartFieldCountryKey.setEnabled(false);
				smartFieldBankKey.setEnabled(false);
				smartFieldIBAN.setEnabled(false);

				smartFieldAccount.attachInitialise(this.onSmartFieldInitialize, this);
				smartFieldCountryKey.attachInitialise(this.onSmartFieldInitialize, this);
				smartFieldBankKey.attachInitialise(this.onSmartFieldInitialize, this);
				smartFieldIBAN.attachInitialise(this.onSmartFieldInitialize, this);
				
				this.objectPageModel = createViewModel();
				this.getOwnerComponent().setModel(this.objectPageModel, "objectPageModel");
				this._initSmartTable();
			},
			
			_initSmartTable: function() {
				var oSmartComponent = this.byId("customer.application01::sap.suite.ui.generic.template.ObjectPage.view.Details::C_BankChainHeaderTP--ITEMFACET::Table");
				if (oSmartComponent) {
					oSmartComponent.getTable().attachUpdateFinished(this.onTableChanged, this);
	
					this.bindViewModelProperty(CREATE_BUTTON_ID, "enabled", "canCreateItem");
				}
			},
			
			onTableChanged: function(event) {
				this.objectPageModel.setProperty("/canCreateItem", event.getSource().getItems().length !== 3);
			},
			
			bindViewModelProperty: function(id, property, path) {
				var control = this.byId(id);
				if (control) {
					if (control.isBound(property)) {
						control.unbindProperty(property, false);
					}
	
					control.bindProperty(property, "objectPageModel>/" + path);
				}
			},

			onSmartFieldInitialize: function () {
				this._setValueHelpOnlyForInputFields();
			},

			_setValueHelpOnlyForInputFields: function () {
				var smartFieldInputAccount = this.getView().byId(
					"DETAIL::BkChnAcctNmbrAtRcpntBkForEdit::Field-input");
				var smartFieldInputCountryKey = this.getView().byId(
					"DETAIL::BkChnCntryKeyOfRcpntBkForEdit::Field-input");
				var smartFieldInputBankKey = this.getView().byId(
					"DETAIL::BkChnBkKeyOfRcpntBkForEdit::Field-input");
				var smartFieldInputIBAN = this.getView().byId(
					"DETAIL::IBAN::Field-input");
				
				if (smartFieldInputAccount) {
					smartFieldInputAccount.setValueHelpOnly(true);
				}
				if (smartFieldInputCountryKey) {
					smartFieldInputCountryKey.setValueHelpOnly(true);
				}
				if (smartFieldInputBankKey) {
					smartFieldInputBankKey.setValueHelpOnly(true);
				}
				if (smartFieldInputIBAN) {
					smartFieldInputIBAN.setValueHelpOnly(true);
				}
			},
			
			_setProperAXModeForChangeDocumentsTable: function() {
				var tableChangeDocuments = this.getView().byId(
					"LOGFACET1::responsiveTable");
				tableChangeDocuments.setKeyboardMode(ListKeyboardMode.Navigation);
			},

			_attachPageDataLoaded: function () {
				this._setProperAXModeForChangeDocumentsTable();
				
				this._setValueHelpOnlyForInputFields();

				var additionalInfoSection = sap.ui.getCore().byId(
					"COLLFACET::Section");
				var ui = this.getView().getModel("ui");
				
				var businessPartnerGroupElement = this.byId("DETAIL::BusinessPartner::GroupElement");
				businessPartnerGroupElement.setVisible(ui.getData().createMode);
				
				if (additionalInfoSection && additionalInfoSection.getVisible() && !ui.getData().editable) {
					additionalInfoSection.setVisible(false);
				} else if (additionalInfoSection && !additionalInfoSection.getVisible() && ui.getData().editable) {
					additionalInfoSection.setVisible(true);
				}
			},

			_attachBeforePopoverOpens: function (oEvent) {
				var BP = oEvent.getSource().getText();
				var attributes = oEvent.getParameters().semanticAttributes;
				attributes.BusinessPartner = BP;
			}
			
		});
		return sap.ui.controller(CONTROLLER_NAME, new Controller());
	},
	true);