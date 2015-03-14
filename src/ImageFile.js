/**
 *  @class ImageFile
 *  
 *  Image file class.
 *  
 *  @var url		URL of image file. Must be on same domain.
 *  @var data		Raw binary data (ArrayBuffer).
 */
 
/**
 * 	ImageFile constructor.
 *
 *	@param url		URL of image file. Must be on same domain.
 */
function ImageFile(url) {
	this.url = url;
	this.data = undefined;
	
	// Load image data.
	this._load();
}

/**
 *  Load image data using AJAX.
 */
ImageFile.prototype._load = function() {	
    var request = new XMLHttpRequest();
    request.open('get', this.url, true);
    request.responseType = 'arraybuffer';
	var image = this;
    request.onload = function () {
        if (request.status !== 200) {
            console.log("Image loading failed", image.url, request.statusText);
			return;
		}
		image.data = request.response;
    };
    request.send();
}
