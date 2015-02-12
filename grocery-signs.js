var DEBUG=false;
	
// PDF.js doesn't like concurrent workers so disable them. This will 
// generate 'Warning: Setting up fake worker.' on the console.
PDFJS.disableWorker = true;

/*
 *
 * Scraping.
 *
 */
 
/** Override default fetch URL. */
fetchUrl = "scraper/fetch.php";


/*
 *
 * Algorithms and functions.
 *
 */

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


/*
 *
 * PDF Generation.
 *
 */

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
			
			// Get or retrieve box coordinates.
			var left   = (typeof(field.left)   == 'number') ? field.left   : fieldCoords[field.left],
				right  = (typeof(field.right)  == 'number') ? field.right  : fieldCoords[field.right],
				top    = (typeof(field.top)    == 'number') ? field.top    : fieldCoords[field.top],
				bottom = (typeof(field.bottom) == 'number') ? field.bottom : fieldCoords[field.bottom];
				
			// Remember coordinates that we know at this stage.
			if (typeof(left)   == 'number') fieldCoords[id + ".left"]   = left;
			if (typeof(right)  == 'number') fieldCoords[id + ".right"]  = right;
			if (typeof(top)    == 'number') fieldCoords[id + ".top"]    = top;
			if (typeof(bottom) == 'number') fieldCoords[id + ".bottom"] = bottom;
			
			if (typeof(left) == 'number' && typeof(right)  == 'number') fieldCoords[id + ".width"]  = right  - left;
			if (typeof(top)  == 'number' && typeof(bottom) == 'number') fieldCoords[id + ".height"] = bottom - top;
			
			if (   typeof(left)   != 'number'
				|| typeof(right)  != 'number'
				|| typeof(top)    != 'number'
				|| typeof(bottom) != 'number') {
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
			var text = normalizeString($("#"+id).val());
			if (text.length > 0) {
				// Text origin.
				var padX = (field.padX || template.padX || 0),
					padY = (field.padY || template.padY || 0);
				doc.translate(padX, padY);

				doc.font(field.font || template.font);
				var type = (field.type || 'text');
				switch (type) {
					case 'text': {
						// Regular text field: use harmonious word wrapping.
						var options = {
							width:    width  - padX*2,
							height:   height - padY*2,
							maxRatio: (field.maxRatio || template.maxRatio || 2)
						};
						var fit = wrapText(doc, text.split(" "), 1, options);
						
						// Output wrapped text line by line.
						var scaleX = options.width  / fit.width,
							scaleY = options.height / (doc.currentLineHeight() * fit.lines.length);
						doc.scale(scaleX, scaleY, {/*empty block needed*/});
						var y = 0;
						for (var i = 0; i < fit.lines.length; i++) {
							// Centered on line
							var lineWidth = doc.widthOfString(fit.lines[i]);
							doc.text(fit.lines[i], (fit.width-lineWidth)/2, y);
							y += doc.currentLineHeight();
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
						var currency = (field.currency || "$");
						var separator = (field.separator || ".");
						var parts = text.split(separator);
						var main = parts[0];
						if (main[0] == currency) main = main.substring(1);
						var decimal = parts[1] || "  ";
						
						// Compute X scaling of currency+main+decimal parts.
						var scaleX = (width - padX) / doc.widthOfString(currency+main+decimal);
						
						// Compute Y scaling of currency+decimal and main parts.
						var scaleY     = (height     - padY*2) / doc.currentLineHeight(),
							scaleYMain = (field.mainHeight - padY*2) / doc.currentLineHeight();
							
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
						var mainShift = (field.mainShift || 0);
						doc.translate(0, mainShift);
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
		page += "<button type='button' class='btn btn-default' onclick='downloadPDF($(\"#page-template-" + i + "\").val())'><span class='glyphicon glyphicon-download'></span> PDF</button>";
		page += "</span>";
		page += "</div>";
		page += "<div id='page-" + i + "' class='page " + pageFormatClass + "'></div>";
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
			var output = $("#page-" + i)[0];
			refreshFrame(output, templates[templateName]);
		});
	});

	refresh();
}

/**
 *  Download the PDF for the given template.
 *  
 *  @param templateName		Template name.
 *  
 *  @see generatePDF()
 */
function downloadPDF(templateName) {
    var stream = generatePDF(templates[templateName]);

    // Download the blob as PDF.
    stream.on('finish', function() {
        saveAs(stream.toBlob('application/pdf'), templateName + ".pdf");
    });
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


/**
 *  Refresh the PDF output frame.
 *  
 *  Typically called from input change event handlers.
 *  
 *  @param container 	Output container.
 *  @param template		Template descriptor.
 *  
 *  @see generatePDF()
 */
function refreshFrame(container, template) {
    var stream = generatePDF(template);

    // Output the PDF blob into given container.
    stream.on('finish', function() {
		var url = stream.toBlobURL('application/pdf');
		renderPDF(url, container);
	});
}

/**
 *  Refresh all active pages.
 */
function refresh() {
	// Call refreshFrame on each active page.
	$(".page").each(function(i, e) {
		var templateName = $("#page-template-" + i).val();
		refreshFrame(e, templates[templateName]);
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


function scrapeMessage(success, title, message) {
	$("#parameters").append(
		  "<div class='alert alert-dismissible alert-" + (success ? "success" : "danger") + " fade in' role='alert'>"
		+ "<button type='button' class='close' data-dismiss='alert' aria-label='Close'><span aria-hidden='true'>&times;</span></button>"
		+ "<strong>" + title + "</strong> "
		+ message
		+ "</div>"
	);
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
 *  Amazon product callback: display result in table.
 *
 *	@param info		Product info or undefined if failure
 *
 *	@see fetch()
 */
function fetchCallback(info) {
	if (info.success) {
		// Success, display product data.
		console.log("success", info);
		scrapeMessage(true, "Success!", "ASIN = <a class='alert-link' target='_blank' href=\'" + info.url + "\'>" + info.asin + "</a>");
		
		$("#FIELD01").val(info.title);
		$("#FIELD02").val(info.vendor);
		$("#FIELD03").val(info.price);
		$("#FIELD08").val(info.asin);
		refresh();
	} else {
		// Failure.
		console.log("failure", info.asin);
		scrapeMessage(false, "Scraping failed!", "ASIN = <a class='alert-link' target='_blank' href=\'" + info.url + "\'>" + info.asin + "</a>");
	}

	// Done!
	enableInterface(true);
}

/**
 *  Search for random Amazon products and display results in table.
 */
function scrapeRandom() {
	// Disable interface elements.
	enableInterface(false);
	
	// Generate random search string.
	var str = randomStr(4);
	progress(1, 2, "Searching for products matching '" + str + "'...")
	search(str, function(results) {
		if (!results || !results.length) {
			// No or invalid results.
			console.log("failure", "Empty results");
			scrapeMessage(false, "Scraping failed!", "Search string = " + str);
			
			// Stop there.
			enableInterface(true);
			return;
		}
		
		// Pick & fetch a random product in the first result page.
		var index = Math.floor(Math.random()*results.length);
		var asin = results[index].asin;
		progress(2, 2, "Fetching product " + asin + "...")
		fetch(asin, fetchCallback);
	});
}

//TODO
function scrapeFields() {
	console.log("autofill");
	scrapeRandom();
}
