/**
 *  @class FontFile
 *  
 *  Font file class.
 *  
 *  @var url        URL of font file. Must be on same domain.
 *  @var data       Raw binary data (ArrayBuffer).
 *  @var opentype   OpenType info parsed by the OpenType.js library.
 */
 
/**
 *  FontFile constructor.
 *
 *  @param url          URL of font file. Must be on same domain.
 *  @param onload       Called when data loaded.
 */
function FontFile(url, onload) {
    this.url = url;
    this.data = undefined;
    this.opentype = undefined;
    
    // Load font data.
    this._load(onload);
}

if (typeof(exports) !== 'undefined') {
    var common = require('../server/common.js');
    var opentype = common.opentype;
    
    var toArrayBuffer = function(buffer) {
        var ab = new ArrayBuffer(buffer.length);
        var u8a = new Uint8Array(ab);
        for (var i = 0; i < buffer.length; ++i) {
            u8a[i] = buffer[i];
        }
        return ab;
    }
    
    /**
     *  Within Node.js. Load font data from file.
     *  
     *  @param onload   Called when data loaded.
     */
    var fs = require('fs');
    FontFile.prototype._load = function(onload) {
        var font = this;
        try {
            font.data = fs.readFileSync('../templates/'+font.url);
            var info = opentype.parse(toArrayBuffer(font.data));
            if (!info.supported) {
                console.log("Font not supported by OpenType.js", font.url);
            } else {
                font.opentype = info;
            }

            // Callback.
            if (onload) onload(this);
        } catch (e) {
            console.log("Font loading failed", font.url, e);
            return;
        }
    }
    module.exports = FontFile;  
} else {
    /**
     *  Within browser. Load font data using AJAX.
     *  
     *  @param onload   Called when data loaded.
     */
    FontFile.prototype._load = function(onload) {   
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

            // Callback.
            if (onload) onload(font);
        };
        request.send();
        console.log("Font loading scheduled", font.url)
    }

    /**
     *  Utility callback, schedules a full refresh upon font loading.
     *  
     *  @param font Loaded FontFile object.
     */
    function fontLoaded(font) {
        console.log("Font loaded", font);
        scheduleRefresh();
    }
}
