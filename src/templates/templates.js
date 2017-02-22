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
 *  - width, height				Page size in points.
 *  - font						Font (see *Font specifiers*).
 *  - maxRatio [default 2]		Maximum y/x scaling ratio used by the word wrapping algorithm. Beyond 
 *  							this value the characters are too narrow and the algorithm uses an
 *  							extra line.
 *  - maxHRatio [default 4]		Maximum x/y scaling ratio for single lines.
 *  - padX, padY [default 0]	Internal box padding in points.
 *  - maxLength					Maximum character length of output strings. Value is either a single
 *  							integer or a [min, max] randomization interval. The actual value is
 *  							computed at each run.
 *  - fields					List of fields.
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
 *	- inputId						ID of input field, useful when spanning text over several
 *									boxes.
 *  
 *  Fields can also override the following template properties:
 *  
 *  - font
 *  - maxRatio
 *  - maxHRatio
 *  - padX, padY
 *  - maxLength
 *  
 *  
 *  ## Text field properties ##
 *  
 *  In addition to the regular field properties, text fields define the following properties:
 *  
 *  - align [default 'center']	Text align for multiline fields. Either 'left', 'right' or 
 *  							'center'.
 *  - filter					Text filter function, takes and return string to display.
 *  
 *  
 *  ## Price field properties ##
 *  
 *  In addition to the regular field properties, price fields define the following properties:
 *  
 *  - currency [default "$"]	Currency sign.
 *  - separator [default "."]	Main/decimal separator sign. May be a single char string or
 *  							a regular expression, e.g. /[.,]/ for comma or point.
 *  - mainHeight				Height of main part, sign and decimal parts use the regular
 *  							box height.
 *  - mainWidth					Fixed width of main part, else all parts scale uniformly.
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

/** Load our fonts. */
//var SansPosterBold = new FontFile("fonts/SansPosterBold.ttf", fontLoaded);
var OpenSansExtraBold = new FontFile("fonts/OpenSans-ExtraBold.ttf", fontLoaded);
var RubikBlack = new FontFile("fonts/Rubik-Black.ttf", fontLoaded); // Hebrew
var ChangaExtraBold = new FontFile("fonts/Changa-ExtraBold.ttf", fontLoaded); // Arabic
// var JejuGothicRegular = new FontFile("fonts/JejuGothic-Regular.ttf", fontLoaded); // Korean
// var MSMHeiBold = new FontFile("fonts/MSMHei-Bold.ttf", fontLoaded); // Chinese

var FontSet1 = [RubikBlack, OpenSansExtraBold, ChangaExtraBold];

var templates = {
	"Rubik Black" : {
		/* Letter */
		width: 		612,
		height: 	792,
		font: 		FontSet1,
		maxRatio: 	2,
		padX: 		10, 
		padY: 		0,
		fields: {
			"FIELD01" : { left: 0,					 top: 77,  right: 612,  bottom: 307  },
			"FIELD02" : { left: 0,					 top: 0,   right: 612,  bottom: 77,  inverted: true },
			"FIELD03" : { left: 0,					 top: 384, right: 612,  bottom: 538, maxLength: 10, type: 'price', currency: "$", separator: /[.,]/, mainHeight: 408 },
			"FIELD04" : { left: 0,					 top: 307, right: 612,  bottom: 384, maxLength: 20 },
			"FIELD05" : { left: "FIELD03.separator", top: 538, right: 612,  bottom: 634, maxLength: [5,30]},
			"FIELD06" : { left: "FIELD03.separator", top: 634, right: 612,  bottom: 730  },
		}
	},
	"Template 1" : {
		/* Letter */
		width: 		612,
		height: 	792,
		font: 		FontSet1,
		maxRatio: 	2,
		maxHRatio: 	2,
		padX: 		10, 
		padY: 		0,
		fields: {
			"FIELD01" :	{ left: 80, 					top: 120, 				right: 560, 				bottom: 270 },
			"FIELD02" : { left: 0,  					top: 0,   				right: 612, 				bottom: 50,  	inverted: true },
			"FIELD03" : { left: 0,						top: 420, 				right: 612, 				bottom: 590, 	maxLength: 10, type: 'price', currency: "$", separator: /[.,]/, mainHeight: 372 },
			"FIELD04" : { left: 10, 					top: 280, 				right: 450, 				bottom: 410 },
			"FIELD05" : { left: "FIELD03.left",			top: "FIELD03.bottom", 	right: "FIELD03.currency",  bottom: 730 },
			"FIELD06" : { left: "FIELD03.separator", 	top: "FIELD03.bottom", 	right: "FIELD03.right",  	bottom: 730 },
			"FIELD07" : { left: 30, 					top: 50,  				right: 582, 				bottom: 110 },
			"FIELD08" : { left: 470, 					top: 300, 				right: 600, 				bottom: 410 },
		}
	},
	"Template 2" : {
		/* Letter */
		width: 		612,
		height: 	792,
		font: 		FontSet1,
		maxRatio: 	2,
		maxHRatio: 	2,
		padX: 		10, 
		padY: 		0,
		fields: {
			"FIELD01" : { left: 140, 			top: 130, 				right: 580, 				bottom: 260 },
			"FIELD02" : { left: 0,  			top: 0,   				right: 612, 				bottom: 50,  	inverted: true },
			"FIELD03" : { left: 0,				top: 390, 				right: 612, 				bottom: 590, 	maxLength: 10, type: 'price', currency: "$", separator: /[.,]/, mainHeight: 380, mainWidth: 400 },
			"FIELD04" : { left: 140, 			top: 280, 				right: 560, 				bottom: 390 },
			"FIELD05" : { left: 470, 			top: 620, 				right: 600,  				bottom: 710,	type: 'image' },
			"FIELD06" : { left: "FIELD03.left",	top: "FIELD03.bottom", 	right: "FIELD03.currency",  bottom: 700 },
			"FIELD07" : { left: 30, 			top: 50,  				right: 582, 				bottom: 110 },
			"FIELD08" : { left: "FIELD03.left",	top: 740, 				right: "FIELD03.right",		bottom: 792 },
			"FIELD09" : { left: 20, 			top: 220, 				right: 110, 				bottom: 310,	type: 'image' },
		}
	},
	"Template 3" : {
		/* Letter */
		width: 		612,
		height: 	792,
		font: 		FontSet1,
		maxRatio: 	2,
		maxHRatio: 	2,
		padX: 		5, 
		padY: 		0,
		fields: {
			"FIELD01.1" : { left: 40, 	top: 100, right: 600, bottom: 145, inputId: "FIELD01", align: 'left', filter: function(text) {return splitWords(text).slice(0, -1).join(" ");} },
			"STATIC01"	: { left: 10,   top: 180, right: 40,  bottom: 240, type: 'static', text: "\u2022", font: 'Helvetica' },
			"FIELD01.2" : { left: 40, 	top: 145, right: 600, bottom: 240, inputId: "FIELD01", align: 'left', filter: function(text) {return splitWords(text).slice(-1).join(" ");} },
			"FIELD02"   : { left: 0, 	top: 0,   right: 612, bottom: 50,  inverted: true },
			"FIELD03"   : { left: 0, 	top: 420, right: 210, bottom: 792 },
			"FIELD04.1" : { left: 40, 	top: 250, right: 520, bottom: 295, inputId: "FIELD04", align: 'left', filter: function(text) {return splitWords(text).slice(0, -1).join(" ");} },
			"STATIC02"	: { left: 10,   top: 330, right: 40,  bottom: 390, type: 'static', text: "\u2022", font: 'Helvetica' },
			"FIELD04.2" : { left: 40, 	top: 295, right: 490, bottom: 390, inputId: "FIELD04", align: 'left', filter: function(text) {return splitWords(text).slice(-1).join(" ");} },
			"FIELD05"   : { left: 400, 	top: 420, right: 612, bottom: 792 },
			"FIELD06"   : { left: 505, 	top: 330, right: 605, bottom: 415, angle: 15, padX: 22, padY: 18, background: new ImageFile("images/bang.png", imageLoaded) },
			"FIELD07"   : { left: 0, 	top: 55,  right: 612, bottom: 95 },
			"STATIC03"	: { left: 220,  top: 420, right: 390, bottom: 670, type: 'static', text: "$" },
			"STATIC04"	: { left: 220,  top: 670, right: 390, bottom: 792, type: 'static', text: "FOR" },
		}
	},
};
