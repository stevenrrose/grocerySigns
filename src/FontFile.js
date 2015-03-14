/**
 *  @class FontFile
 *  
 *  Font file class.
 *  
 *  @var url		URL of font file. Must be on same domain.
 *  @var data		Raw binary data (ArrayBuffer).
 *  @var opentype	OpenType info parsed by the OpenType.js library.
 */
 
/**
 * 	FontFile constructor.
 *
 *	@param url		URL of font file. Must be on same domain.
 */
function FontFile(url) {
	this.url = url;
	this.data = undefined;
	this.opentype = undefined;
	
	// Load font data.
	this._load();
}

/**
 *  Load font data using AJAX.
 */
FontFile.prototype._load = function() {	
    var request = new XMLHttpRequest();
    request.open('get', this.url, true);
    request.responseType = 'arraybuffer';
	var font = this;
    request.onload = function () {
        if (request.status !== 200) {
            console.log("Font loading failed", font.url, request.statusText);
			return;
		}
		font.data = request.response;
		var info = opentype.parse(font.data);
		if (!info.supported) {
			console.log("Font not supported by OpenType.js", font.url);
		} else {
			font.opentype = info;
		}
    };
    request.send();
}
