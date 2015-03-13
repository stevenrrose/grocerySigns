/**
 *  Load font file using AJAX.
 *  
 *	@param url		URL of font file. Must be on same domain.
 *	@param font		Target object. Raw data stored in *font.data*, OpenType 
 *					parsed info in *font.opentype*.
 */
function loadFont(url, font) {	
    var request = new XMLHttpRequest();
    request.open('get', url, true);
    request.responseType = 'arraybuffer';
    request.onload = function () {
        if (request.status !== 200) {
            console.log("Font loading failed", url, request.statusText);
			return;
		}
		font.data = request.response;
		var info = opentype.parse(font.data);
		if (!info.supported) {
			console.log("Font not supported by OpenType.js", url);
		} else {
			font.opentype = info;
		}
    };
    request.send();
}

// Load our fonts.
var Raiders = {}; loadFont("fonts/Raiders.ttf", Raiders);
var SansPosterBold = {}; loadFont("fonts/SansPosterBold.ttf", SansPosterBold);
var ArialBlack = {}; loadFont("fonts/ArialBlack.ttf", ArialBlack);
