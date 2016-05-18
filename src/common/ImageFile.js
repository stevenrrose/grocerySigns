/**
 *  @class ImageFile
 *  
 *  Image file class.
 *  
 *  @var url        URL of image file. Must be on same domain.
 *  @var type       MIME type.
 *  @var data       Image data in data URI base-64 format.
 */
 
/**
 *  ImageFile constructor.
 *
 *  @param url          URL of image file. Must be on same domain.
 *  @param onload       Called when data loaded.
 */
function ImageFile(url, onload) {
    this.url = url;
    this.type = undefined;
    this.data = undefined;
    
    // Load image data.
    this._load(onload);
}

if (typeof(exports) !== 'undefined') {
    /**
     *  Within Node.js. Load image data from file.
     *  
     *  @param onload   Called when data loaded.
     */
    var fs = require('fs');
    ImageFile.prototype._load = function(onload) {
        var image = this;
        try {
            //FIXME handle remote URLs
            image.data = fs.readFileSync('../templates/'+image.url);
            /*TODO
            image.type = this.getResponseHeader('content-type');
            */

            // Callback.
            if (onload) onload(this);
        } catch (e) {
            console.log("Image loading failed", font.url, e);
            return;
        }
    }
    module.exports = ImageFile;  
} else {
    /**
     *  Within browser. Load image data using AJAX.
     *  
     *  @param onload   Called when data loaded.
     */
    ImageFile.prototype._load = function(onload) {  
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

            // Callback.
            if (onload) onload(image);
        };
        request.send();
        console.log("Image loading scheduled", image.url)
    }

    /**
     *  Utility callback, schedules a full refresh upon image loading.
     *  
     *  @param image    Loaded ImageFile object.
     */
    function imageLoaded(image) {
        console.log("Image loaded", image.url);
        scheduleRefresh();
    }
}
