var DEBUG=false;

/**
 *  Split string into words.
 *  
 *  @param text     String to split.
 */
function splitWords(text) {
    return text.split(/\s+/);
}

/**
 *  Word fitting algorithm.
 *  
 *  Try to form lines of harmonious proportions. To do so, try all possible
 *  combinations of words and keep the narrowest one. This is a very naive
 *  recursive algorithm but it works fine for our purpose (the number of words 
 *  and lines is low).
 *  
 *  @param doc      The PDFDocument.
 *  @param words    Array of words to fill lines with.
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
 *  Word wrap algorithm.
 *
 *  Calls *fitWords* with increasing *nbLines* values until an acceptable 
 *  scaling ratio is found.
 *
 *  @param doc      The PDFDocument.
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
        // Add lines. Optimize the number of calls by estimating the needed number of 
        // extra lines from the square root of the scaleY / (maxRatio * scaleX) ratio.
        var incr = Math.floor(Math.sqrt(scaleY/(options.maxRatio*scaleX)));
        return wrapText(doc, words, Math.min(words.length, nbLines+incr), options);
    }
}

/**
 *  Normalize string:
 *  
 *  - trim outer spaces
 *  - collate inner spaces
 *  - convert to uppercase
 *  
 *  @param s    String to normalize.
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
 * Merge all objects given as arguments into the first one. Similar to 
 * jquery.extend.
 */
function mergeObjects() {
    for(var i=1; i<arguments.length; i++) {
        for(var key in arguments[i]) {
            if(arguments[i].hasOwnProperty(key)) {
                arguments[0][key] = arguments[i][key];
            }
        }
    }
    return arguments[0];
}

/**
 *  Generate PDF from input fields for a given template.
 *  
 * @param {object}  stream      Output stream.
 * @param {object}  template    Template descriptor.
 * @param {object}  sentences   Field ID => text map.
 * @param {array}   images      List of ImageFile.
 */
function generatePDF(stream, template, sentences, images) {
    console.log(sentences, images);
    // Create PDF document with template size.
    var doc = new PDFDocument({size: [template.width, template.height]});
    doc.pipe(stream);

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
    
    // Image index. Each image field consumes images in order.
    var imageIndex = 0;
    
    while (Object.keys(doneFields).length < Object.keys(template.fields).length)
    {
        var progress = false;
        
        for (var id in template.fields) {
            if (doneFields[id]) continue;
            
            var field = template.fields[id];
            var fieldOptions = mergeObjects({
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
                continue;
            }

            // Compute box dimensions.
            var width  = right  - left,
                height = bottom - top;
            
                
            doc.save();
            
            // Box origin.
            doc.translate(left, top);

            // Rotation.
            if (fieldOptions.angle) doc.rotate(fieldOptions.angle);
            
            if (DEBUG) {
                doc.rect(0, 0, width, height).stroke();
                if (field.mainHeight) doc.rect(0, 0, width, field.mainHeight).stroke();
            }

            if (field.inverted) {
                // White on black.
                doc.rect(0, 0, width, height).fill('black');
                doc.fill('white');
            }
            
            if (field.background) {
                // Background image.
                doc.image(field.background.data, 0, 0, {width: width, height: height});
            }
            
            if (fieldOptions.type == 'image') {
                // Output next scraped image.
                if (imageIndex <= images.length && images[imageIndex] && images[imageIndex].data) {
                    try {
                        doc.image(images[imageIndex].data, 0, 0, {fit: [width, height], align: 'center', valign: 'center'});
                    } catch (e) {
                        console.error("generatePDF", "PDFKit exception with image", images[imageIndex], e);
                    }
                    imageIndex++;
                }
            } else {
                // Get & normalize field value.
                var text;
                if (fieldOptions.type == 'static') {
                    text = fieldOptions.text;
                } else {
                    text = sentences[fieldOptions.inputId];
                }
                text = normalizeString(text);
                if (fieldOptions.filter) text = fieldOptions.filter(text);
                maxLength = fieldOptions.actualMaxLength;
                if (maxLength) text = text.substring(0, maxLength);
                if (text.length > 0) {
                    // Text origin.
                    var padX = fieldOptions.padX,
                        padY = fieldOptions.padY;
                    doc.translate(padX, padY);

                    var font = fieldOptions.font;
                    doc.font(typeof(font) === 'string' ? font : font.data);
                    switch (fieldOptions.type) {
                        case 'text':
                        case 'static': {
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
                                        case 'left':    x = 0;                          break;
                                        case 'right':   x = (fit.width - lineWidth);    break;
                                        default:        x = (fit.width - lineWidth)/2;  break;
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
                                    case 'left':    x = 0;                          break;
                                    case 'right':   x = (options.width - lineWidth * scaleX);   break;
                                    default:        x = (options.width - lineWidth * scaleX)/2;     break;
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
            }           
            doc.restore();
            
            // Done!
            doneFields[id] = true;
            progress = true;
        }
        
        // Check progress.
        if (!progress) {
            // No progress, stop there.
            break;
        }
    }
    
    // Done.
    doc.end();
}
