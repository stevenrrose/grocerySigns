/**
 *  @class ImageFile
 *  
 *  Image file class.
 *  
 *  @var url		URL of image file. Must be on same domain.
 *  @var type		MIME type.
 *  @var data		Image data in data URI base-64 format.
 */
 
/**
 * 	ImageFile constructor.
 *
 *	@param url		URL of image file. Must be on same domain.
 */
function ImageFile(url) {
	this.url = url;
	this.type = undefined;
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
	request.onreadystatechange = function() {
		// Grab image type.
		image.type = this.getResponseHeader('content-type');
	}
    request.onload = function() {
        if (request.status !== 200) {
            console.log("Image loading failed", image.url, request.statusText);
			return;
		}
		
		// Image data. PDFKit wants data URIs and not Array buffer.
		image.data =
			"data:" 
			+ image.type 
			+ ";base64,"
			+ btoa(String.fromCharCode.apply(null, new Uint8Array(request.response)));
    };
    request.send();
}
