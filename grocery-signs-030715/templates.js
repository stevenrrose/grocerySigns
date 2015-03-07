/**
 * @file templates.js
 *  
 *  Template declaration.
 *  
 *  Templates are defined in the global map *templates*, used in other parts of the application.
 *  
 *  
 *  ## Template properties ##
 *  
 *  Each template is identified by its key name, the set of keys is used to fill the template 
 *  select inputs in the HTML UI. Template value is an object with the following properties:
 *  
 *  - width, height		Page size in points.
 *  - font				Font (see *Font specifiers*).
 *  - maxRatio			Maximum y/x scaling ratio used by the word wrapping algorithm. Beyond 
 *  					this value the characters are too narrow and the algorithm uses an
 *  					extra line.
 *  - padX, padY		Internal box padding in points.
 *  - fields			List of fields.
 *  - maxLength			Maximum character length of output strings. Value is either a single
 *  					integer or a [min, max] randomization interval. The actual value is
 *  					computed at each run.
 *  
 *  
 *  ## Field properties ##
 *  
 *  Each field key name must match an HTML input field. Field value is an object with the
 *  following properties:
 *  
 *  - left, top, right, bottom		Box coordinates (see *Coordinate specifiers*).
 *  - inverted [default false]		If true, field is white text on black box.
 *  - type [default 'text'] 		Field type, must be either 'text' for regular fields or 
 *									'price' for price fields.
 *  
 *  Fields can also override the following template properties:
 *  
 *  - font
 *  - maxRatio
 *  - padX, padY
 *  - maxLength
 *  
 *  
 *  ## Price field properties ##
 *  
 *  In addition to the regular text field properties, price fields define the following 
 *  properties:
 *  
 *  - currency [default "$"]	Currency sign.
 *  - separator [default "."]	Main/decimal separator sign.
 *  - mainHeight				Height of main part, sign and decimal parts use the regular
 *  							box height.
 *  - mainShift [default 0]		Vertical shift in points for main part. This is to ensure
 *  							visually correct alignment of main text top with currency 
 *  							and decimal parts. Unfortunately the PDF library doesn't
 *  							provide the adequate font metrics so this has to be set 
 *  							manually.
 *  
 *  
 *  ## Font specifiers ##
 *  
 *  A font specifier can be a string giving the name of a standard PDF fonts enclosed between
 *  single or double quotes (e.g. 'Times-Roman' or 'Helvetica').
 *  It can also be an embedded font object, in this case the font specifier is the name of the
 *  variable holding the font data, without quotes. This variable must  be declared from the 
 *  main HTML page before including this file, typically by including a .js file from the 
 *  fonts/ subdir.
 *  
 *  
 *  ## Coordinate specifiers ##
 *  
 *  Field coordinates are typically given as absolute numeric values in points, but relative
 *  values are supported in the form of string specifiers enclosed in single or double quotes.
 *  Supported formats are:
 *  
 *  - "width", "height"			Template page dimension.
 *  - "<FIELDNAME>.left",
 * 	  "<FIELDNAME>.right",
 *    "<FIELDNAME>.top",
 *    "<FIELDNAME>.bottom",
 *    "<FIELDNAME>.width"
 *    "<FIELDNAME>.height"		Computed dimension of the field identified by *FIELDNAME*.
 *  - "<FIELDNAME>.currency"	For price field *FIELDNAME*, right coordinate of currency 
 *  							sign / left coordinate of main price part.
 *  - "<FIELDNAME>.separator"	For price field *FIELDNAME*, right coordinate of main price 
 *  							part / left coordinate of decimal part.
 *  
 *  
 *  @see refresh()
 */
 
/** Global max length for text fields. */
var globalMaxLength = 100;

var templates = {
	"Raiders (Letter)" : {
		/* Letter */
		width: 		612,
		height: 	792,
		font: 		Raiders,
		maxRatio: 	2,
		padX: 		10, 
		padY: 		0,
		fields : {
			"FIELD01" : { left: 0,					 top: 77,  right: 612,  bottom: 307  },
			"FIELD02" : { left: 0,					 top: 0,   right: 612,  bottom: 77,  inverted: true },
			"FIELD03" : { left: 0,					 top: 384, right: 612,  bottom: 538, maxLength: 10, type: 'price', currency: "$", separator: ".", mainHeight: 408, mainShift: -55 },
			"FIELD04" : { left: 0,					 top: 307, right: 612,  bottom: 384, maxLength: 20 },
			"FIELD05" : { left: "FIELD03.separator", top: 538, right: 612,  bottom: 634, maxLength: [5,30]},
			"FIELD06" : { left: "FIELD03.separator", top: 634, right: 612,  bottom: 730  },
		}
	},
	"SansPosterBold (A4)" : {
		/* A4 */
		width: 		595,
		height: 	842,
		font: 		SansPosterBold,
		maxRatio: 	2,
		padX: 		10, 
		padY: 		0,
		fields : {
			"FIELD01" : { left: 0,					 top: "FIELD02.bottom", right: "width", bottom: 307  },
			"FIELD02" : { left: 0,					 top: 0,	  			right: "width", bottom: 77,  inverted: true },
			"FIELD03" : { left: 0,					 top: 384, 				right: "width", maxLength: 10, bottom: 538, type: 'price', currency: "$", separator: ".", mainHeight: 408, mainShift: -55 },
			"FIELD04" : { left: 0,					 top: 307, 				right: "width", bottom: 384  },
			"FIELD05" : { left: "FIELD03.separator", top: 538, 				right: "width", bottom: 634  },
			"FIELD06" : { left: "FIELD03.separator", top: 634, 				right: "width", bottom: 730  },
		}
	},
	"Helvetica (Letter)" : {
		/* Letter */
		width: 		612,
		height: 	792,
		font: 		"Helvetica",
		maxRatio: 	2,
		padX: 		10, 
		padY: 		10,
		fields : {
			"FIELD01" : { left: 0,					 top: 77,  right: 612,  bottom: 307  },
			"FIELD02" : { left: 0,					 top: 0,   right: 612,  bottom: 77,  inverted: true },
			"FIELD03" : { left: 0,					 top: 384, right: 612,  bottom: 538, maxLength: 10, type: 'price', currency: "$", separator: ".", mainHeight: 408 },
			"FIELD04" : { left: 0,					 top: 307, right: 612,  bottom: 384, maxLength: 15 },
			"FIELD05" : { left: "FIELD03.separator", top: 538, right: 612,  bottom: 634  },
			"FIELD06" : { left: "FIELD03.separator", top: 634, right: 612,  bottom: 730  },
		}
	},
};
