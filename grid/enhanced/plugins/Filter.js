dojo.provide("dojox.grid.enhanced.plugins.Filter");

dojo.requireLocalization("dojox.grid.enhanced", "Filter");
dojo.require("dojox.grid.enhanced._Plugin");
dojo.require("dojox.grid.enhanced.plugins.filter.FilterLayer");
dojo.require("dojox.grid.enhanced.plugins.filter.UniqueLayer");
dojo.require("dojox.grid.enhanced.plugins.filter.SortLayer");
dojo.require("dojox.grid.enhanced.plugins.filter.FilterBar");
dojo.require("dojox.grid.enhanced.plugins.filter.FilterDefDialog");
dojo.require("dojox.grid.enhanced.plugins.filter.FilterStatusTip");
dojo.require("dojox.grid.enhanced.plugins.filter.ClearFilterConfirm");
dojo.require("dijit.Dialog");

(function(){
	var ns = dojox.grid.enhanced.plugins,
		fns = ns.filter;
		
	dojo.declare("dojox.grid.enhanced.plugins.Filter", dojox.grid.enhanced._Plugin, {
		// summary:
		//		Provide filter functionality for grid.
		//
		//		Acceptable plugin parameters:
		//		1. itemsName: string	
		//			the name shown on the filter bar.
		//		2. statusTipTimeout: number 
		//			when does the status tip show.
		//		3. ruleCount: number 
		//			default to 3, should not change to more. The Claro theme limits it.
		//		4. disabledConditions: object
		//			If you don't need all of the conditions provided for a data type,
		//			you can explicitly declare them here:
		//			e.g.: disabledConditions: {string: ["contains", "is"], number: ["equalto"], ...}
		//		5. isServerSide: boolean
		//			Whether to use server side filtering. Default to false.
		//		6. isStateful: boolean
		//			If isServerSide is true, set the server side filter to be stateful or not. default to false.
		//		7. url: string
		//			If using stateful, this is the url to send commands. default to store.url.
		//
		//		Acceptable cell parameters defined in layout:
		//		1. filterable: boolean
		//			The column is not filterable only when this is set to false explicitly.
		//		2. datatype: string
		//			The data type of this column. Can be "string", "number", "date", "time", "boolean". 
		//			Default to "string".
		//		3. autoComplete: boolean
		//			If need auto-complete in the ComboBox for String type, set this to true.
		//		4. dataTypeArgs: object
		//			Some arguments helping convert store data to something the filter UI understands.
		//			Different data type arguments can be provided to different data types.
		//			For date/time, this is a dojo.date.locale.__FormatOptions, so the DataTimeBox can understand the store data.
		//			For boolean, this object contains:
		//				trueLabel: string
		//					A label to display in the filter definition dialog for true value. Default to "True".
		//				falseLable: string
		//					A label to display in the filter definition dialog for false value. Default to "False".
		//		5. disabledConditions: object
		//			If you don't need all of the conditions provided by the filter UI on this column, you can explicitly say it out here.
		//			e.g.: disabledConditions: ["contains", "is"]
		//			This will disable the "contains" condition for this column, if this column is of string type.
		//			For full set of conditions, please refer to dojox.grid.enhanced.plugins.filter.FilterDefDialog._setupData.
		// example:
		//	|	<div dojoType="dojox.grid.EnhancedGrid" plugins="{GridFilter: true}" ...></div>
		//	|	or provide some parameters:
		//	|	<div dojoType="dojox.grid.EnhancedGrid" plugins="{GridFilter: {itemsName: 'songs'}}" ...></div>
		//	|	Customize columns for filter:
		//	|	var layout = [
		//	|		...
		//	|		//define a column to be un-filterable in layout/structure
		//	|		{field: "Genre", filterable: false, ...} 
		//	|		//define a column of type string and supports autoComplete when you type in filter conditions.
		//	|		{field: "Writer", datatype: "string", autoCommplete: true, ...} 
		//	|		//define a column of type date and the data in store has format: "yyyy/M/d"
		//	|		{field: "Publish Date", datatype: "date", dataTypeArgs: {datePattern: "yyyy/M/d"}, ...}
		//	|		//disable some conditions for a column
		//	|		{field: "Track", disabledConditions: ["equalto","notequalto"], ...}
		//	|		...
		//	|	];
		
		// name: String
		//		plugin name
		name: "gridFilter",
		
		constructor: function(inGrid, args){
			// summary: 
			//		See constructor of dojox.grid.enhanced._Plugin.

			this.grid = inGrid;
			this.nls = dojo.i18n.getLocalization("dojox.grid.enhanced", "Filter");
			
			args = this.args = dojo.isObject(args) ? args : {};
			if(typeof args.ruleCount != 'number' || args.ruleCount <= 0){
				args.ruleCount = 3;
			}
			
			//Install filter layer
			this._wrapStore();
			
			//Install UI components 
			var obj = {
				"plugin": this
			};
			this.clearFilterDialog = new dijit.Dialog({
				title: this.nls["clearFilterDialogTitle"],
				content: new fns.ClearFilterConfirm(obj)
			});
			this.filterDefDialog = new fns.FilterDefDialog(obj);
			this.filterBar = new fns.FilterBar(obj);
			this.filterStatusTip = new fns.FilterStatusTip(obj);
			
			this._store = inGrid.store;
			this.connect(inGrid, "setStore", function(store){
				if(store !== this._store){
					ns.unwrap(this._store);
					this._wrapStore();
					this.connect(store.layer('filter'), "filterDef", dojo.hitch(this.filterDefDialog, "_onSetFilter"));
					this.connect(store.layer("filter"),"onFiltered", dojo.hitch(this.filterBar, "_onFiltered"));
					this.filterDefDialog.clearFilter(true);
					this._store = store;
				}
			});
		},
		destroy: function(){
			this.inherited(arguments);
			try{
				this.filterBar.destroyRecursive();
				this.filterBar = null;
				this.clearFilterDialog.destroyRecursive();
				this.clearFilterDialog = null;
				this.filterStatusTip.destroy();	
				this.filterStatusTip = null;
				this.filterDefDialog.destroy();
				this.filterDefDialog = null;
				this._store.unwrap("sort");
				this._store.unwrap("unique");
				this._store.unwrap("filter");
			}catch(e){
				console.error("filter destroy:",e);
			}
		},
		_wrapStore: function(){
			var g = this.grid;
			var args = this.args;
			var filterLayer = args.isServerSide ? new fns.ServerSideFilterLayer(args) : 
				new fns.ClientSideFilterLayer({
					filterCacheSize: args.cacheSize,
					fetchAllOnFirstFilter: args.fetchAll,
					getter: dojo.hitch(g, function(/* data item */ datarow,/* cell */cell, /* int */rowIndex){
						// summary:
						//		Define the grid-specific way to get data from a row.
						//		Argument "cell" is provided by FilterDefDialog when defining filter expressions.
						//		Argument "rowIndex" is provided by FilterLayer when checking a row.
						//		FilterLayer also provides a forth argument: "store", which is grid.store,
						//		but we don't need it here.
						return cell.get(rowIndex, datarow);
					})
				});
			var uniqueLayer = new fns.UniqueLayer();
			var sortLayer = new fns.SortLayer();
			
			uniqueLayer.enabled(false);
			sortLayer.enabled(false);
			ns.wrap(ns.wrap(ns.wrap(g.store, filterLayer), uniqueLayer), sortLayer);
		}
	});
})();

dojox.grid.EnhancedGrid.registerPlugin('filter', dojox.grid.enhanced.plugins.Filter);