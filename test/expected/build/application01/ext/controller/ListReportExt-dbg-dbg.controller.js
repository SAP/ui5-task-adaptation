/*
 * Copyright (C) 2009-2025 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define([
		"sap/ui/base/Object",
		"sap/ui/comp/smartfilterbar/DisplayBehaviour"
	], function (
		Parent,
		DisplayBehaviour
	) {
		"use strict";
		
		var oSmartFilter;
		var CONTROLLER_NAME = "customer.application01.ext.controller.ListReportExt";
		var SMART_TABLE_IGNORED_FIELDS = ["BkChnBankAccountNumberForUI", 
										  "BusinessPartner",  
										  "BkChnBusinessPartnerListReport"];
		var SMART_FILTER_FORMATTED_FIELDS = ["BkChnCntryKeyOfRcpntBkForEdit",
											 "BkChnCntryKeyOfSndrBkForEdit",
											 "BkChnBkKeyOfRcpntBkForEdit",
											 "BkChnBkKeyOfSndrBkForEdit",
											 "BkChnCurrencyKeyForEdit"];
										  

		function clearBusinessPartnerFilter(aFilters) {
			return aFilters.find(function(oFilter) {
				if (oFilter.aFilters) {
					clearBusinessPartnerFilter(oFilter.aFilters);
				}
				
				if (oFilter.sPath && oFilter.sPath === SMART_TABLE_IGNORED_FIELDS[2]) {
					oFilter.oValue1 = "";
					return true;
				}
				
				return false;
			});
		}
		
		function onUpdateBusinessPartner() {
			var aBusinessPartnerTokens = this.oBusinessPartnerFilter.getTokens();
			var aCheck = [];
			var aRes = [];
			for ( var i = 0, len = aBusinessPartnerTokens.length; i < len; i++ ) {
    			if (!aCheck.includes(aBusinessPartnerTokens[i].getProperty("key"))) {
    				aCheck.push(aBusinessPartnerTokens[i].getProperty("key"));
    				aRes.push(aBusinessPartnerTokens[i]);
    			}
			}
			this.oBusinessPartnerFilter.setTokens(aRes);
		}
		
		var Controller = Parent.extend(CONTROLLER_NAME, {
			
			onInit: function() {
				var oSmartComponent = this.byId("listReport");
				oSmartComponent.setIgnoredFields(SMART_TABLE_IGNORED_FIELDS.join(","));
				
				oSmartFilter = this.byId("listReportFilter");
				oSmartFilter.getControlConfiguration().forEach(function (oControlConfiguration) {
					if (SMART_FILTER_FORMATTED_FIELDS.indexOf(oControlConfiguration.getProperty("key")) >= 0) {
						oControlConfiguration.setDisplayBehaviour(DisplayBehaviour.idAndDescription);
					}
            	});
			},
			
			onBeforeRebindTableExtension: function(oEvent) {
				var oBindingParams = oEvent.getParameter("bindingParams");
				clearBusinessPartnerFilter(oBindingParams.filters);
			},
			
			onInitSmartFilterBarExtension: function(oEvent) {
				this.oBusinessPartnerFilter = oSmartFilter.getControlByKey(SMART_TABLE_IGNORED_FIELDS[2]);
            	if (this.oBusinessPartnerFilter) {
            		this.oBusinessPartnerFilter.attachTokenUpdate(onUpdateBusinessPartner.bind(this));
            	}
			}
			
		});
		return sap.ui.controller(CONTROLLER_NAME, new Controller());
	},
	true);