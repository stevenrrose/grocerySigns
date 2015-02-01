var DEBUG=false;

/**
 * Normalize string:
 *
 * - trim outer spaces
 * - collate inner spaces
 * - convert to uppercase
 *
 *  @param s    String to normalize
 */
function normalizeString(s) {
    return s
        .trim()
        .replace(/\s+/g, " ")
        .toUpperCase()
    ;
}

/**
 * Refresh the PDF output frames.
 *
 * Typically called from input change event handlers.
 */
function refresh() {
    // Output iframe.
    var output = $("#output")[0];
    
    // Selected template.
    var template = templates[$("#template").val()];
    
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
			var left   = (typeof(field.left)   == "number") ? field.left   : fieldCoords[field.left],
				right  = (typeof(field.right)  == "number") ? field.right  : fieldCoords[field.right],
				top    = (typeof(field.top)    == "number") ? field.top    : fieldCoords[field.top],
				bottom = (typeof(field.bottom) == "number") ? field.bottom : fieldCoords[field.bottom];
				
			// Remember coordinates that we know.
			if (typeof(left)   == "number") fieldCoords[id + ".left"] = left;
			if (typeof(right)  == "number") fieldCoords[id + ".right"] = right;
			if (typeof(top)    == "number") fieldCoords[id + ".top"] = top;
			if (typeof(bottom) == "number") fieldCoords[id + ".bottom"] = bottom;
			
			if (   typeof(left)   != "number"
				|| typeof(right)  != "number"
				|| typeof(top)    != "number"
				|| typeof(bottom) != "number") {
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

    // Output the PDF blob into given iframe.
    doc.end();
    stream.on('finish', function() {
        output.src = stream.toBlobURL('application/pdf');
    });
}

/**
 * Word fitting algorithm.
 *
 *  Try to form lines of harmonious proportions. To do so, try all possible
 *  combinations of words and keep the narrowest one. This is a very naive
 *  recursive algorithm but it works fine for our purpose (the number of words 
 *  and lines is low).
 *
 *  @param doc      The PDFDocument.
 *  @param word     Array of words to fill lines with.
 *  @param nbLines  Number of lines to fill.
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
 * Word wrap algorithm.
 *
 *  Calls *fitWords* with increasing *nbLines* values until an acceptable 
 *  scaling ratio is found.
 *
 *  @param doc      The PDFDocument.
 *  @param words    Array of words to form lines with.
 *  @param nbLines  Minimum number of lines to form.
 *  @param options  Options:
 *                  - width     Width of target box
 *                  - height    Height of target box
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
