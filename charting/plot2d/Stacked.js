dojo.provide("dojox.charting.plot2d.Stacked");

dojo.require("dojox.charting.plot2d.common");
dojo.require("dojox.charting.plot2d.Default");

dojo.require("dojox.lang.functional");
dojo.require("dojox.lang.functional.sequence");
dojo.require("dojox.lang.functional.reversed");

(function(){
	var df = dojox.lang.functional, dc = dojox.charting.plot2d.common,
		purgeGroup = df.lambda("item.purgeGroup()");

	dojo.declare("dojox.charting.plot2d.Stacked", dojox.charting.plot2d.Default, {
		//	summary:
		//		Like the default plot, Stacked sets up lines, areas and markers
		//		in a stacked fashion (values on the y axis added to each other)
		//		as opposed to a direct one.
		calculateAxes: function(dim){
			//	summary:
			//		Run the calculations for any axes for this plot.
			//	dim: Object
			//		An object in the form of { width, height }
			//	returns: dojox.charting.plot2d.Stacked
			//		A reference to this plot for functional chaining.
			var stats = dc.collectStackedStats(this.series);
			this._maxRunLength = stats.hmax;
			this._calc(dim, stats);
			return this;	//	dojox.charting.plot2d.Stacked
		},
		render: function(dim, offsets){
			//	summary:
			//		Run the calculations for any axes for this plot.
			//	dim: Object
			//		An object in the form of { width, height }
			//	offsets: Object
			//		An object of the form { l, r, t, b}.
			//	returns: dojox.charting.plot2d.Stacked
			//		A reference to this plot for functional chaining.
			if(this._maxRunLength <= 0){
				return this;
			}

			// stack all values
			var acc = df.repeat(this._maxRunLength, "-> 0", 0);
			for(var i = 0; i < this.series.length; ++i){
				var run = this.series[i];
				for(var j = 0; j < run.data.length; ++j){
					var v = run.data[j];
					if(v !== null){
						if(isNaN(v)){ v = 0; }
						acc[j] += v;
					}
				}
			}
			// draw runs in backwards
			if(this.zoom && !this.isDataDirty()){
				return this.performZoom(dim, offsets);
			}
			this.dirty = this.isDirty();
			if(this.dirty){
				dojo.forEach(this.series, purgeGroup);
				this.cleanGroup();
				var s = this.group;
				df.forEachRev(this.series, function(item){ item.cleanGroup(s); });
			}

			var t = this.chart.theme, events = this.events(),
				ht = this._hScaler.scaler.getTransformerFromModel(this._hScaler),
				vt = this._vScaler.scaler.getTransformerFromModel(this._vScaler);
			this.resetEvents();

			for(var i = this.series.length - 1; i >= 0; --i){
				var run = this.series[i];
				if(!this.dirty && !run.dirty){
					t.skip();
					continue;
				}
				run.cleanGroup();
				var theme = t.next(this.opt.areas ? "area" : "line", [this.opt, run], true),
					s = run.group, outline,
					lpoly = dojo.map(acc, function(v, i){
						return {
							x: ht(i + 1) + offsets.l,
							y: dim.height - offsets.b - vt(v)
						};
					}, this);

				var lpath = this.opt.tension ? dc.curve(lpoly, this.opt.tension) : "";
				
				if(this.opt.areas){
					var apoly = dojo.clone(lpoly);
					if(this.opt.tension){
						var p=dc.curve(apoly, this.opt.tension);
						p += " L" + lpoly[lpoly.length - 1].x + "," + (dim.height - offsets.b) +
							" L" + lpoly[0].x + "," + (dim.height - offsets.b) +
							" L" + lpoly[0].x + "," + lpoly[0].y;
						run.dyn.fill = s.createPath(p).setFill(theme.series.fill).getFill();
					} else {
						apoly.push({x: lpoly[lpoly.length - 1].x, y: dim.height - offsets.b});
						apoly.push({x: lpoly[0].x, y: dim.height - offsets.b});
						apoly.push(lpoly[0]);
						run.dyn.fill = s.createPolyline(apoly).setFill(theme.series.fill).getFill();
					}
				}
				if(this.opt.lines || this.opt.markers){
					if(theme.series.outline){
						outline = dc.makeStroke(theme.series.outline);
						outline.width = 2 * outline.width + theme.series.stroke.width;
					}
				}
				if(this.opt.markers){
					run.dyn.marker = theme.symbol;
				}
				var frontMarkers, outlineMarkers, shadowMarkers;
				if(theme.series.shadow && theme.series.stroke){
					var shadow = theme.series.shadow,
						spoly = dojo.map(lpoly, function(c){
							return {x: c.x + shadow.dx, y: c.y + shadow.dy};
						});
					if(this.opt.lines){
						if(this.opt.tension){
							run.dyn.shadow = s.createPath(dc.curve(spoly, this.opt.tension)).setStroke(shadow).getStroke();
						} else {
							run.dyn.shadow = s.createPolyline(spoly).setStroke(shadow).getStroke();
						}
					}
					if(this.opt.markers){
						shadow = theme.marker.shadow;
						shadowMarkers = dojo.map(spoly, function(c){
							return s.createPath("M" + c.x + " " + c.y + " " + theme.symbol).
								setStroke(shadow).setFill(shadow.color);
						}, this);
					}
				}
				if(this.opt.lines){
					if(outline){
						if(this.opt.tension){
							run.dyn.outline = s.createPath(lpath).setStroke(outline).getStroke();
						} else {
							run.dyn.outline = s.createPolyline(lpoly).setStroke(outline).getStroke();
						}
					}
					if(this.opt.tension){
						run.dyn.stroke = s.createPath(lpath).setStroke(theme.series.stroke).getStroke();
					} else {
						run.dyn.stroke = s.createPolyline(lpoly).setStroke(theme.series.stroke).getStroke();
					}
				}
				if(this.opt.markers){
					frontMarkers = new Array(lpoly.length);
					outlineMarkers = new Array(lpoly.length);
					outline = null;
					if(theme.marker.outline){
						outline = dc.makeStroke(theme.marker.outline);
						outline.width = 2 * outline.width + (theme.marker.stroke ? theme.marker.stroke.width : 0);
					}
					dojo.forEach(lpoly, function(c, i){
						var path = "M" + c.x + " " + c.y + " " + theme.symbol;
						if(outline){
							outlineMarkers[i] = s.createPath(path).setStroke(outline);
						}
						frontMarkers[i] = s.createPath(path).setStroke(theme.marker.stroke).setFill(theme.marker.fill);
					}, this);
					if(events){
						dojo.forEach(frontMarkers, function(s, i){
							var o = {
								element: "marker",
								index:   i,
								run:     run,
								plot:    this,
								hAxis:   this.hAxis || null,
								vAxis:   this.vAxis || null,
								shape:   s,
								outline: outlineMarkers[i] || null,
								shadow:  shadowMarkers && shadowMarkers[i] || null,
								cx:      lpoly[i].x,
								cy:      lpoly[i].y,
								x:       i + 1,
								y:       run.data[i]
							};
							this._connectEvents(s, o);
						}, this);
					}
				}
				run.dirty = false;
				// update the accumulator
				for(var j = 0; j < run.data.length; ++j){
					var v = run.data[j];
					if(v !== null){
						if(isNaN(v)){ v = 0; }
						acc[j] -= v;
					}
				}
			}
			this.dirty = false;
			return this;	//	dojox.charting.plot2d.Stacked
		}
	});
})();
