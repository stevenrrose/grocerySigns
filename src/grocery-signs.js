var DEBUG=false;

// Whether to use FileSave.js' saveAs() or plain <a> link.
var USE_SAVEAS=false;

/*
 *
 * Scraping.
 *
 */
 
/** Override default fetch URL. */
fetchUrl = "scraper/fetch.php";

/** Last scraped ID. */
var lastScrapedId;

/*
 *
 * Algorithms and functions.
 *
 */

 
/** 
 *  Generate random seed.
 */
function generateRandomSeed() {
	return Math.floor(Math.random() * 1000000);
}

var randomSeed = generateRandomSeed();


/**
 *  Seeded random number generator as JS doesn't provide one by default.
 *  
 *  @see http://indiegamr.com/generate-repeatable-random-numbers-in-js/ for the magic numbers.
 */
function srandom() {
    randomSeed = (randomSeed * 9301 + 49297) % 233280;
    return randomSeed / 233280;
}

/**
 * Generate a random string.
 *
 *	@param size		Size of string to generate.
 */
function randomStr(size) {
	var chars = "0123456789abcdefghijklmnopqrstuvwxyz";
	var str = "";
	for (var i=0; i < size; i++) {
		str += chars[Math.floor(Math.random()*chars.length)];
	}
	return str;
}

/**
 *  Split string into sentences.
 *  
 *  @param text		String to split.
 */
function splitSentences(text) {
	return text.replace(/([!?]|\.\.\.)\s+/g, "$1. ").split(/[.;]\s/);
}

/**
 *  Split string into words.
 *  
 *  @param text		String to split.
 */
function splitWords(text) {
	return text.split(/\s+/);
}

/**
 * 	Randomize array element order in-place (using seeded random function).
 *
 * 	Uses Fisher-Yates shuffle algorithm.
 *
 *  @param array	Array to shuffle.
 *
 *  @see srandom()
 *	@see http://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array#answer-12646864
 */
function shuffleArray(array) {
    for (var i = array.length - 1; i > 0; i--) {
        var j = Math.floor(srandom() * (i + 1));
        var temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    }
    return array;
}

/**
 *  Normalize string:
 *  
 *  - trim outer spaces
 *  - collate inner spaces
 *  - convert to uppercase
 *  
 *  @param s 	String to normalize.
 */ 
function normalizeString(s) {
	if (typeof(s) === 'undefined') return "";
    return s
        .trim()
        .replace(/\s+/g, " ")
        .toUpperCase()
    ;
}

/**
 *  Word fitting algorithm.
 *  
 *  Try to form lines of harmonious proportions. To do so, try all possible
 *  combinations of words and keep the narrowest one. This is a very naive
 *  recursive algorithm but it works fine for our purpose (the number of words 
 *  and lines is low).
 *  
 *  @param doc     	The PDFDocument.
 *  @param words   	Array of words to fill lines with.
 *  @param nbLines 	Number of lines to fill.
 */ 
function fitWords(doc, words, nbLines) {
    // Stop conditions.
    if (nbLines == 1) {
        // Single line.
        var line = words.join(" ");
        return {
            lines: [line], 
            width: doc.widthOfString(line)
        };
    } else if (words.length < nbLines) {
        // Less words than lines.
        return {
            lines: [],
            width: +Infinity
        }
    }
    
    // Word fitting algorithm: form the first line then recurse on remaining
    // lines & words.
    var fit = {
        lines: [],
        width: +Infinity
    };
    for (var i = 0; i < words.length; i++) {
        // First line.
        var line0 = words.slice(0, i+1).join(" ");
        var width0 = doc.widthOfString(line0);
        if (width0 >= fit.width) continue; // No need to continue.
        
        // Recurse on remaining lines.
        var remainder = fitWords(doc, words.slice(i+1), nbLines-1);
        if (remainder.width >= fit.width) continue; // No need to continue.
        
        // This one is better.
        var width = Math.max(width0, remainder.width);
        fit.lines = [line0].concat(remainder.lines);
        fit.width = width;
    }
    return fit;
}

/**
 *  Word wrap algorithm.
 *
 *  Calls *fitWords* with increasing *nbLines* values until an acceptable 
 *  scaling ratio is found.
 *
 *  @param doc     	The PDFDocument.
 *  @param words    Array of words to form lines with.
 *  @param nbLines  Minimum number of lines to form.
 *  @param options  Options:
 *                  - width     Width of target box.
 *                  - height    Height of target box.
 *                  - maxRatio  Maximum y/x scaling ratio. Beyond this value the
 *                              characters are too narrow.
 */
function wrapText(doc, words, nbLines, options) {
    // Find best fit for given number of lines.
    var fit = fitWords(doc, words, nbLines);
    var scaleX = options.width  / fit.width,
        scaleY = options.height / (doc.currentLineHeight() * nbLines);
    if (scaleY <= options.maxRatio*scaleX || words.length == nbLines) {
        // Ratio is acceptable or we can't add lines anymore.
        return fit;
    } else {
        // Add a line.
        return wrapText(doc, words, nbLines+1, options);
    }
}

/**
 *  Compute actual template field max length; values may be specified as single integer
 *  or [min, max] randomization intervals (uses seeded random).
 *  
 *  @see srandom()
 */
function computeActualMaxFieldLengths() {
	var actualValue = function(spec) {
		if (spec) {
			// Option specified.
			if (spec.length == 2) {
				// Specified as [min, max].
				var min=spec[0], max=spec[1];
				return min + srandom() * (max-min);
			} else {
				// Use raw specified value.
				return spec;
			}
		}
	}
	$.each(templates, function(key, template) {
		// Template-level option.
		template.actualMaxLength = actualValue(template.maxLength);
		
		// Field-level options.
		$.each(template.fields, function(fkey, field) {
			field.actualMaxLength = actualValue(field.maxLength);
		});
	});
}
 
// Call at least once at startup.
computeActualMaxFieldLengths();


/*
 *
 * PDF Generation.
 *
 */

// PDF.js doesn't like concurrent workers so disable them. This will 
// generate 'Warning: Setting up fake worker.' on the console.
PDFJS.disableWorker = true;

/**
 *  Generate PDF from input fields for a given template.
 *  
 *  @param template		Template descriptor.
 *  
 *  @return Stream object, caller should bind the 'finish' event to get the generated data.
 *  
 *  @see refreshFrame()
 */
function generatePDF(template) {
    // Create PDF document with template size.
    var doc = new PDFDocument({size: [template.width, template.height]});
    var stream = doc.pipe(blobStream());

	//
    // Iterate over fields until none is left or displayable. As some fields use relative placement,
	// they must be displayed after the fields they depend on. So we make several passes until we
	// get enough info to display such fields properly.
	//
	
	// Remember fields done so far.
	var doneFields = [];
	
	// Array of field coordinates. This is simply a string map whose key is a simple specifier such as "FIELDNAME.left".
	// Field types may define extra dimension specifiers (e.g. "price" fields define "FIELDNAME.separator for x position 
	// of price separator). There are also template-wide coordinates for page dimensions.
	var fieldCoords = {
		"width"  : template.width,
		"height" : template.height
	};
	
	while (Object.keys(doneFields).length < Object.keys(template.fields).length)
	{
		var progress = false;
		
		$.each(template.fields, function(id, field) {
			if (doneFields[id]) return;
			
			var fieldOptions = $.extend({
					inputId: id,
					type: 'text', 
					padX: 0, padY: 0, 
					actualMaxLength: globalMaxLength, 
					maxRatio: 2,
					maxHRatio: 4,
					align: 'center',
					currency: "$",
					separator: ".",
				}, template, field);
		
			// Get or retrieve box coordinates.
			var left   = (typeof(field.left)   === 'number') ? field.left   : fieldCoords[field.left],
				right  = (typeof(field.right)  === 'number') ? field.right  : fieldCoords[field.right],
				top    = (typeof(field.top)    === 'number') ? field.top    : fieldCoords[field.top],
				bottom = (typeof(field.bottom) === 'number') ? field.bottom : fieldCoords[field.bottom];
				
			// Remember coordinates that we know at this stage.
			if (typeof(left)   === 'number') fieldCoords[id + ".left"]   = left;
			if (typeof(right)  === 'number') fieldCoords[id + ".right"]  = right;
			if (typeof(top)    === 'number') fieldCoords[id + ".top"]    = top;
			if (typeof(bottom) === 'number') fieldCoords[id + ".bottom"] = bottom;
			
			if (typeof(left) === 'number' && typeof(right)  === 'number') fieldCoords[id + ".width"]  = right  - left;
			if (typeof(top)  === 'number' && typeof(bottom) === 'number') fieldCoords[id + ".height"] = bottom - top;
			
			if (   typeof(left)   !== 'number'
				|| typeof(right)  !== 'number'
				|| typeof(top)    !== 'number'
				|| typeof(bottom) !== 'number') {
				// We're still missing some info, try next loop iteration.
				return;
			}

			// Compute box dimensions.
			var width  = right  - left,
				height = bottom - top;
			
				
			doc.save();
			
			// Box origin.
			doc.translate(left, top);
			
			if (DEBUG) {
				doc.rect(0, 0, width, height).stroke();
				if (field.mainHeight) doc.rect(0, 0, width, field.mainHeight).stroke();
			}

			if (field.inverted) {
				// White on black.
				doc.rect(0, 0, width, height).fill('black');
				doc.fill('white');
			}
	 
			// Get & normalize field value.
			var text = normalizeString($("#" + fieldOptions.inputId).val());
			if (fieldOptions.filter) text = fieldOptions.filter(text);
			maxLength = fieldOptions.actualMaxLength;
			if (maxLength) text = text.substring(0, maxLength);
			if (text.length > 0) {
				// Text origin.
				var padX = fieldOptions.padX,
					padY = fieldOptions.padY;
				doc.translate(padX, padY);
				if (fieldOptions.angle) doc.rotate(fieldOptions.angle);

				var font = fieldOptions.font;
				doc.font(typeof(font) === 'string' ? font : font.data);
				switch (fieldOptions.type) {
					case 'text': {
						// Regular text field: use harmonious word wrapping.
						var options = {
							width:    width  - padX*2,
							height:   height - padY*2,
							maxRatio: fieldOptions.maxRatio,
						};
						var fit = wrapText(doc, splitWords(text), 1, options);
						
						if (fit.lines.length > 1) {
							// Output wrapped text line by line.
							var scaleX = options.width  / fit.width,
								scaleY = options.height / (doc.currentLineHeight() * fit.lines.length);
							doc.scale(scaleX, scaleY, {/*empty block needed*/});
							var y = 0;
							for (var i = 0; i < fit.lines.length; i++) {
								var lineWidth = doc.widthOfString(fit.lines[i]);
								var x;
								switch (fieldOptions.align) {
									case 'left':  	x = 0; 				   			break;
									case 'right': 	x = (fit.width - lineWidth); 	break;
									default: 		x = (fit.width - lineWidth)/2; 	break;
								}
								doc.text(fit.lines[i], x, y);
								y += doc.currentLineHeight();
							}
						} else {
							// Single line: limit ratio in horizontal direction as well.
							var lineWidth = doc.widthOfString(fit.lines[0]);
							var scaleX = options.width  / lineWidth;
								scaleY = options.height / doc.currentLineHeight();
							if (scaleX > scaleY * fieldOptions.maxHRatio) {
								scaleX = scaleY * fieldOptions.maxHRatio;
							}
							var x;
							switch (fieldOptions.align) {
								case 'left':  	x = 0; 				   			break;
								case 'right': 	x = (options.width - lineWidth * scaleX); 	break;
								default: 		x = (options.width - lineWidth * scaleX)/2; 	break;
							}
							doc.translate(x, 0);
							doc.scale(scaleX, scaleY, {/*empty block needed*/});
							doc.text(fit.lines[0], 0, 0);
						}
						break;
					}
					case 'price': {
						// Price field have 3 parts:
						// - Currency sign
						// - Main part (taller)
						// - Decimal part
						// All 3 parts use the same X scaling (i.e. the char widths
						// are the same), but the main part is taller and so uses
						// a greater Y factor.
						var currency = fieldOptions.currency;
						var separator = fieldOptions.separator;
						var parts = text.split(currency);
						parts = parts[parts.length-1].split(separator);
						var main = parts[0];
						var decimal = parts[1] || "  ";
						
						// Compute X scaling of currency+main+decimal parts.
						var scaleX = (width - padX) / doc.widthOfString(currency+main+decimal);
						
						// Compute Y scaling of currency+decimal and main parts.
						var scaleY     = (height                  - padY*2) / doc.currentLineHeight(),
							scaleYMain = (fieldOptions.mainHeight - padY*2) / doc.currentLineHeight();
							
						// Output parts.
						var x = 0;
						
						// - Currency.
						doc.save();
						doc.scale(scaleX, scaleY, {/*empty block needed*/});
						doc.text(currency, x, 0);
						doc.restore();
						x += doc.widthOfString(currency);
						fieldCoords[id + ".currency"] = left + x*scaleX;
						
						// - Main.
						doc.save();
						if (font.opentype) {
							// Shift main part upwards to align character tops.
							// - Logical line height = ascender - descender.
							var line = font.opentype.ascender - font.opentype.descender;
							
							// - Logical top position = yMax for glyph 'T' (could be any other glyph with top bar).
							var top = font.opentype.ascender - font.opentype.charToGlyph('T').yMax;
							
							// - Actual top position for each part.
							var yBase = top * (height                  - padY*2) / line,
								yMain = top * (fieldOptions.mainHeight - padY*2) / line;
							doc.translate(0, yBase-yMain);
						}
						doc.scale(scaleX, scaleYMain, {/*empty block needed*/});
						doc.text(main, x, 0);
						doc.restore();
						x += doc.widthOfString(main);
						fieldCoords[id + ".separator"] = left + x*scaleX;
						
						// - Decimal.
						doc.scale(scaleX, scaleY, {/*empty block needed*/});
						doc.text(decimal, x, 0);
					}
				}
			}
			doc.restore();
			
			// Done!
			doneFields[id] = true;
			progress = true;
		});
		
		// Check progress.
		if (!progress) {
			// No progress, stop there.
			break;
		}
	}

	// Return stream to caller, which should typically bind the 'finish' event to get 
	// the generated data.
    doc.end();
    return stream;
}

/**
 *  Render PDF in a canvas using PDF.js.
 *  
 *  @param url       	URL of PDF to render (supports blob and data URIs).
 *  @param container	Canvas container.
 */
function renderPDF(url, container) {
    PDFJS.getDocument(url).then(function(pdfDoc) {
		/* Only render the first page. */
		pdfDoc.getPage(1).then(function(page) {
			/* Compute ideal scaling factor: twice the page width for optimal subsampling. */
			var pageWidth = page.getViewport(1).width;
			var scale = 2*$(container).width()/pageWidth;
			
			/* Create viewport and canvas. */
			var viewport = page.getViewport(scale);
			var canvas = document.createElement('canvas');
			canvas.height = viewport.height;
			canvas.width = viewport.width;
			$(container).empty().append(canvas);

			/* Render page. */
			page.render({
				canvasContext: canvas.getContext('2d'),
				viewport: viewport
			});
		});
    });
}   


/*
 *
 * Interface functions.
 *
 */
 
/** Default page format class (see grocery-signs.css) */
var pageFormatClass = "page-iso";

/** Remember selected templates for each page so that we can change the layout
 *  while preserving the template order. By default pages display all available
 *  templates in order. */
var selectedTemplates = Object.keys(templates);

/** Delay for scheduled refresh events. */
var refreshDelay = 500; /*ms*/

/** Last scheduled refresh event. */
var refreshEvent = null;

/** Last scraped sentences. */
var scrapedSentences = [];

/** Last random seed at scrape time. */
var lastRandomSeed = randomSeed;

/**
 *  Generate field inputs from template specs.
 */
function generateFieldInputs() {
	// Merge all templates field names.
	var fieldNames = {};
	$.each(templates, function(key, template) {
		$.each(template.fields, function(id, field) {
			if (field.inputId) id = field.inputId;
			fieldNames[id] = 1;
		});
	});	

	// Generate inputs.
	$.each(fieldNames, function(id) {
		$("#fields form").append($('<div class="form-group" />')
			.append($('<label for="' + id + '" class="col-sm-3 control-label" />').text(id))
			.append($('<div class="col-sm-9" />')
				.append('<input class="FIELD form-control" id="' + id + '" />')
			)
		);
	});
	$(".FIELD").change(scheduleRefresh).keyup(scheduleRefresh);
}

/**
 *  Build the output page elements.
 */
function buildPages() {
	// No need to display more pages than available templates.
	var nbPages = Object.keys(templates).length;
	
    // Adjust column layout.
    var columns = parseInt($("#columns").val());
	var colClass;
    switch (columns) {
        case 0:
            // Automatic, use 3-column responsive layout.
            columns = 4;
            colClass = "col-xs-12";
            if (nbPages >= 2) {
                colClass += " col-sm-6";
            }
            if (nbPages >= 3) {
                colClass += " col-md-4";
            }
            if (nbPages >= 4) {
                colClass += " col-lg-3";
            }
            break;
            
        case 1:
            colClass = "col-xs-12";
            break;
            
        case 2:
            colClass = "col-xs-12 col-sm-6";
            break;
            
        case 3:
            colClass = "col-xs-12 col-sm-4";
            break;
            
        case 4:
            colClass = "col-xs-12 col-sm-3";
            break;
            
        case 6:
            colClass = "col-xs-12 col-sm-2";
            break;
    }

	// Don't display more pages than needed.
    var rows = parseInt($("#rows").val());
	nbPages = Math.min(nbPages, columns * rows);
	
    // Clear existing pages.
    var $pages = $("#pages");
    $pages.empty();
    
	// Create page elements.
	for (var i=0; i < nbPages; i++) {
		var page = "<div class='page-container " + colClass + "'>";
		page += "<div class='thumbnail'>";
        page += "<div class='input-group input-group-sm'>";
		page += "<select id='page-template-" + i + "' class='page-template form-control'></select>";
        page += "<span class='input-group-btn'>";
		if (USE_SAVEAS) {
			// Download uses saveAs().
			page += "<button type='button' class='btn btn-default' onclick='downloadPDF(" + i + ")'><span class='glyphicon glyphicon-download'></span> PDF</button>";
		} else {
			// Use plain download link with attributes set in refreshFrame(). 
			page += "<a role='button' id='page-download-" + i + "' class='btn btn-default'><span class='glyphicon glyphicon-download'></span> PDF</a>";
		}
		page += "</span>";
		page += "</div>";
		page += "<div id='page-" + i + "' data-index='" + i + "' class='page " + pageFormatClass + "'></div>";
		page += "</div>";
		page += "</div>";
		$pages.append(page);
	}
	
	// Populate template selects from *templates* keys (see templates.js), and bind change event.
	$(".page-template").each(function(i, e) {
		// Add each template name to select.
		$.each(templates, function(key) {
			$(e).append(new Option(key));
		});
		
		// Select active template.
		$(e).val(selectedTemplates[i]);
		
		// Refresh page on change.
		$(e).change(function() {
			// Remember newly selected template.
			var templateName = $(e).val();
			selectedTemplates[i] = templateName;
			
			// Refresh page.
			refreshFrame(i);
		});
	});

	refresh();
}

/**
 *  Get file name for the given page.
 *  
 *  @param index	Page index.
 *  
 *  @see generatePDF()
 *  @see refreshFrame()
 */
function getFileName(index) {
	var templateName = $("#page-template-" + index).val();
	
	if (!lastScrapedId) {
		// Manual input.
		return templateName + ".pdf";
	}
	
	var provider = $("#autofill-provider option:selected").text();
	var filename = provider + "-" + lastScrapedId + "-" + templateName;
	if ($("#randomize").prop('checked')) {
		filename += "-" + $("#seed").val();
	}
	return filename + ".pdf";
}

/**
 *  Download the PDF for the given page.
 *  
 *  @param index	Page index.
 *  
 *  @see generatePDF()
 *  @see getFileName()
 */
function downloadPDF(index) {
	var templateName = $("#page-template-" + index).val();
	var fileName = getFileName(index);
	
    var stream = generatePDF(templates[templateName]);

    // Download the blob as PDF.
    stream.on('finish', function() {
        saveAs(stream.toBlob('application/pdf'), fileName);
    });
}

/**
 *  Refresh the PDF output frame.
 *  
 *  Typically called from input change event handlers.
 *  
 *  @param index	Page index.
 *  
 *  @see generatePDF()
 *  @see getFileName()
 */
function refreshFrame(index) {
	var container = $("#page-" + index);
	var templateName = $("#page-template-" + index).val();
	var fileName = getFileName(index);
	
    var stream = generatePDF(templates[templateName]);

    // Output the PDF blob into given container.
    stream.on('finish', function() {
		var url = stream.toBlobURL('application/pdf');
		renderPDF(url, container);
		if (!USE_SAVEAS) {
			// Set link attributes.
			var index = $(container).data("index");
			$("#page-download-" + index)
				.attr('href', url)
				.attr('target', '_blank')
				.attr('download', fileName);
		}
	});
}

/**
 *  Refresh all active pages.
 */
function refresh() {
	// Call refreshFrame on each active page.
	$(".page").each(function(index) {
		refreshFrame(index);
	});
}

/**
 *  Schedule a refresh event.
 *  
 *  This allows for interactive usage without having to recompute the whole UI at 
 *  each keypress.
 */
function scheduleRefresh() {
	if (refreshEvent) {
		clearTimeout(refreshEvent);
	}
	refreshEvent = setTimeout(function() {refresh(); refreshEvent = null;}, refreshDelay);
}

/**
 *  Update progress information during scraping.
 *
 *	@param step			Step (starts at 1).
 *	@param nbSteps		Total number of steps.
 *	@param stepLabel	Human-readable step label to display.
 */
function progress(step, nbSteps, stepLabel) {
    var percent = (step/(nbSteps+1))*100;
    $("#progress .progress-bar").attr('aria-valuenow', step).attr('aria-valuemax', nbSteps+1).attr('style','width:'+percent.toFixed(2)+'%').find("span").html(step + "/" + nbSteps);
    $("#progressStep").html(stepLabel);
}

/**
 *  Enable/disable interface.
 *
 *	@param enabled	Whether to enable or disable interface.
 */
function enableInterface(enabled) {
	$("#progressDialog").modal(enabled?'hide':'show');
}

/**
 *  Display scraping result message.
 *  
 *  @param success 	Whether the operation was successful.
 *  @param title   	Message title.
 *  @param message 	Message body.
 */
function scrapeMessage(success, title, message) {
	$("#parameters").append(
		  "<div class='alert small alert-dismissible alert-" + (success ? "success" : "danger") + " fade in' role='alert'>"
		+ "<button type='button' class='close' data-dismiss='alert' aria-label='Close'><span aria-hidden='true'>&times;</span></button>"
		+ "<span class='glyphicon glyphicon-" + (success ? "ok" : "exclamation") + "-sign'></span> "
		+ "<strong class='sr-only'>" + title + "</strong> "
		+ message
		+ "</div>"
	);
}

/**
 *  Populate fields 
 */
function populateFields() {
	var values;
	if ($("#randomize").prop('checked')) {
		// Filter out empty strings.
		values = scrapedSentences.filter(function(val) {return (val != "");});
		
		// Randomize remaining strings. Reset random seed first.
		randomSeed = lastRandomSeed;
		shuffleArray(values);
	} else {
		// Use sentences in order.
		values = scrapedSentences;
	}

	// Populate fields with resulting values.
	$(".FIELD").each(function(i, e) {
		$(e).val(values[i]);
	});
}

/**
 *  Fetch product callback: display result in fields.
 *
 *	@param provider		Product provider descriptor.
 *	@param info			Product info.
 */
function fetchCallback(provider, info) {
	console.log(info);		
	if (info.success) {
		// Success, gather & display product data.
		scrapeMessage(true, "Success!", provider.name + " ID = <a class='alert-link' target='_blank' href=\'" + info.url + "\'>" + info.itemId  + "</a>");
		
		// Remember item ID for filename generation.
		lastScrapedId = info.itemId;
		
		// Build sentences to populate fields with.
		// - title, vendor and price (even empty to ensure predictable order).
		scrapedSentences = [
			normalizeString(info.title), 
			normalizeString(info.vendor), 
			normalizeString(info.price),
		];
		// - nonempty feature bullet items.
		$.each(info.features, function(i, v) {
			v = normalizeString(v);
			if (v != "") scrapedSentences.push(v);
		});
		// - nonempty description sentences.
		$.each(info.description, function(i, v) {
			v = normalizeString(v);
			if (v != "") scrapedSentences.push(v);
		});
		
		// Trigger display with a new random speed.
		$("#seed").val(generateRandomSeed()).change();
	} else {
		// Failure.
		scrapeMessage(false, "Scraping failed!", provider.name + " ID = <a class='alert-link' target='_blank' href=\'" + info.url + "\'>" + info.itemId + "</a>");
	}

	// Done!
	enableInterface(true);
}

/**
 *  Search for random products and call fetchCallback() upon result.
 *  
 *  @param provider		Provider to scrape.
 */
function scrapeRandom(provider) {
	// Disable interface elements.
	enableInterface(false);
	
	// Generate random search string.
	var str = randomStr(provider.randomSearchStringLength);
	progress(1, 2, "Searching for " + provider.name + " products matching '" + str + "'...")
	provider.search(str, function(results) {
		if (!results || !results.length) {
			// No or invalid results.
			console.log("failure", "Empty results");
			scrapeMessage(false, "Scraping failed!", provider.name + " search string = " + str);
			
			// Stop there.
			enableInterface(true);
			return;
		}
		
		// Pick & fetch a random product in the first result page.
		var index = Math.floor(Math.random()*results.length);
		var itemId = results[index].itemId;
		progress(2, 2, "Fetching " + provider.name + " product " + itemId + "...");
		provider.fetch(itemId, function(info) {fetchCallback(provider, info);});
	});
}

/**
 * Scrape product given its item ID.
 *  
 *  @param provider		Provider to scrape.
 *	@param itemId		Item ID of the product to scrape.
 */
function scrapeItem(provider, itemId) {
	// Disable interface elements.
	enableInterface(false);
	
	// Fetch given item.
	itemId = itemId.trim();
	progress(1, 1, "Fetching " + provider.name + " product " + itemId + "...");
	provider.fetch(itemId, function(info) {fetchCallback(provider, info);});
}

/**
 *  Scrape random data from the currently selected provider.
 */
function scrapeFields() {
	var provider = providers[$("#autofill-provider").val()];
	scrapeRandom(provider);
}

/**
 *  Called when random seed is changed by any means. Reshuffles fields & refresh pages.
 */
function seedChanged() {
	lastRandomSeed = $("#seed").val();
	computeActualMaxFieldLengths();
	populateFields();
	refresh();
}
