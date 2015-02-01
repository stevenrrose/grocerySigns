var templates = {
	"template1" : {
		/* Letter */
		width: 612,
		height: 792,
		font: Raiders,
		maxRatio: 2,
		padX: 10, padY: 0,
		fields : {
			"FIELD01" : {left: 0,					top: 77,  right: 612, bottom: 307  },
			"FIELD02" : {left: 0,					top: 0,	  right: 612, bottom: 77,  inverted: true},
			"FIELD03" : {left: 0,					top: 384, right: 612, bottom: 538, type: 'price', currency: "$", separator: ".", mainHeight: 408, mainShift: -55},
			"FIELD04" : {left: 0,					top: 307, right: 612, bottom: 384  },
			"FIELD05" : {left: "FIELD03.separator", top: 538, right: 612, bottom: 634  },
			"FIELD06" : {left: "FIELD03.separator", top: 634, right: 612, bottom: 730  }
		}
	}
};
