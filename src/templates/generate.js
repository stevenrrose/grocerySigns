var DEBUG=false;

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

/** Random seed value used by srandom(). */
var randomSeed = generateRandomSeed();

/**
 *  Seeded random number generator as JS doesn't provide one by default.
 *  
 *  @see generateRandomSeed()
 *  @see randomSeed
 *  @see http://indiegamr.com/generate-repeatable-random-numbers-in-js/ for the magic numbers.
 */
function srandom() {
    randomSeed = (randomSeed * 9301 + 49297) % 233280;
    return randomSeed / 233280;
}

/**
 *  Randomize array element order in-place (using seeded random function).
 *
 *  Uses Fisher-Yates shuffle algorithm.
 *
 *  @param array    Array to shuffle.
 *
 *  @see srandom()
 *  @see http://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array#answer-12646864
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
 * Shuffle the sentence list.
 * 
 * @param {array} sentences     list of sentence strings
 * @param {type}  seed          random seed used by srandom()
 * 
 * @returns {array} shuffled sentence list
 */
function shuffleSentences(sentences, seed) {
    // Filter out empty strings.
    var values = sentences.filter(function(val) {return (val != "");});
        
    // Randomize remaining strings. Reset random seed first.
    randomSeed = seed;
    shuffleArray(values);
    return values;
}

/**
 * Shuffle the image list.
 * 
 * @param {array} images        list of ImageFile objects
 * @param {type}  seed          random seed used by srandom()
 * 
 * @returns {array} shuffled image list
 */
function shuffleImages(images, seed) {
    // Make a copy first.
    var values = images.slice();
    
    // Randomize images. Reset random seed first.
    randomSeed = seed;
    shuffleArray(values);
    return values;
}

/**
 *  Split string into words.
 *  
 *  @param {string} text    String to split.
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
    // Temporarily replace doc.widthOfString() by a memoizing version, this 
    // dramatically accelerates the algorithm.
    doc.widthOfString_original = doc.widthOfString;
    var cache = {};
    doc.widthOfString = function(string) {
        if (!cache[string]) {
            cache[string] = doc.widthOfString_original(string);
        }
        return cache[string];
    }
    
    while (true) {
        // Find best fit for given number of lines.
        var fit = fitWords(doc, words, nbLines);
        var scaleX = options.width  / fit.width,
            scaleY = options.height / (doc.currentLineHeight() * nbLines);
        if (scaleY <= options.maxRatio*scaleX || words.length == nbLines) {
            // Ratio is acceptable or we can't add lines anymore.
            break;
        }
    
        // Add lines. Optimize the number of calls by estimating the needed number of 
        // extra lines from the square root of the scaleY / (maxRatio * scaleX) ratio.
        var incr = Math.floor(Math.sqrt(scaleY/(options.maxRatio*scaleX)));
        nbLines = Math.min(words.length, nbLines+incr);
    }
    
    // Revert to the original doc.widthOfString().
    doc.widthOfString = doc.widthOfString_original;
    
    return fit;
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
    for (var i=1; i<arguments.length; i++) {
        for (var key in arguments[i]) {
            if (typeof(arguments[i][key]) !== 'undefined') {
                arguments[0][key] = arguments[i][key];
            }
        }
    }
    return arguments[0];
}

/**
 *  Compute actual template field max length; values may be specified as single integer
 *  or [min, max] randomization intervals (uses seeded random).
 *  
 *  @param {number} seed random seed
 *  
 *  @see srandom()
 */
function computeActualMaxFieldLengths(seed) {
    randomSeed = seed;
    
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
    for (var key in templates) {
        var template = templates[key];
        // Template-level option.
        template.actualMaxLength = actualValue(template.maxLength);
        
        // Field-level options.
        for (var fkey in template.fields) {
            var field = template.fields[fkey];
            field.actualMaxLength = actualValue(field.maxLength);
        }
    }
}

// Call at least once at startup.
computeActualMaxFieldLengths(randomSeed);


/*
 *
 * PDF Generation.
 *
 */

/**
 *  Generate PDF from input fields for a given template.
 *  
 * @param {object}  stream          Output stream.
 * @param {object}  template        Template descriptor.
 * @param {object}  fields          Field ID => text map.
 * @param {array}   images          List of ImageFile.
 * @param {object}  globalOptions   Global options.
 */
function generatePDF(stream, template, fields, images, globalOptions) {
    globalOptions = globalOptions||{};
    
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
                    color: 'black',
                }, globalOptions, template, field);
        
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
                doc.rect(0, 0, width, height).fill(fieldOptions.color);
                doc.fill('white');
            } else {
                doc.fill(fieldOptions.color);
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
                    text = fields[fieldOptions.inputId];
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
                    doc.font(typeof(font) === 'string' ? font : bestMatchingFont(font, text).data);
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
                            var decimal = parts[1];
                            if (!decimal && main.length >4 ) {
                                decimal = main.substring(main.length-2);
                                main = main.substring(0, main.length-2);
                            }
                            
                            // Compute X scaling of currency+main+decimal parts.
                            var scaleX, scaleXMain;
                            if (fieldOptions.mainWidth) {
                                scaleX = (width - padX - fieldOptions.mainWidth) / doc.widthOfString(currency+(decimal||'00'));
                                scaleXMain = fieldOptions.mainWidth / doc.widthOfString(main);
                            } else {
                                scaleX = (width - padX) / doc.widthOfString(currency+main+(decimal||'00'));
                                scaleXMain = scaleX;
                            }
                            
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
                            doc.scale(scaleXMain, scaleYMain, {/*empty block needed*/});
                            doc.text(main, x*scaleX/scaleXMain, 0);
                            doc.restore();
                            x += doc.widthOfString(main)*scaleXMain/scaleX;
                            fieldCoords[id + ".separator"] = left + x*scaleX;
                            
                            // - Decimal.
                            doc.scale(scaleX, scaleY, {/*empty block needed*/});
                            doc.text(decimal||'', x, 0);
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

/**
 *  Select best font for a given text.
 *
 *  @param fonts    Single FontFile or array of FontFile's.
 *  @param text     Text string to render.
 *
 *  @return best matching FontFile
 */
function bestMatchingFont(fonts, text) {
    if (!fonts.length) {
        // Single font.
        return fonts;
    }
    
    // Iterate over fonts and find one with the highest number of supported glyphs.
    var max = -1;
    var maxFont;
    for (var i = 0; i < fonts.length; i++) {
        var font = fonts[i];
        if (!font.opentype) continue; // No OpenType info, unusable.
        
        // Count number of supported glyphs.
        var nb = 0;
        for (var j = 0; j < text.length; j++) {
            var c = text.charAt(j);
            if (font.opentype.charToGlyphIndex(c)) nb++;
        }
        
        if (nb > max) {
            // This one is better.
            max = nb;
            maxFont = font;
        }
    }
    return maxFont;
}