var request = require('request');
var express = require('express');
var swig = require('swig');
var mongoose = require('mongoose');
mongoose.connect('mongodb://localhost/grocery-signs');

/**
 * app
 * 
 * Main Express router instance. 
 */
var app = express();

/*
 * Static routes.
 */
app.use(express.static(__dirname + '/../client'));
app.use(express.static(__dirname + '/../templates'));
app.use('/scraper', express.static(__dirname + '/../scraper'));

/**
 * /
 * 
 * Application root.
 */
app.get('/', function(req, res) {
  res.sendFile('/client/grocery-signs.html', {root: __dirname + '/..'});
});

/**
 * /scraper/fetch
 * 
 * Simple proxy for scraper, allow client-side code to bypass CORS restriction 
 * on remote sites.
 * 
 * @param url URL of page to retrieve
 */
app.get('/scraper/fetch', function(req, res) {
    request(req.query.url).pipe(res);
});

/**
 * Image
 * 
 * Mongoose model for downloaded image data.
 * 
 * @property url URL of image (unique key)
 * @property type MIME type of image
 * @property data Binary image data
 * 
 * @see /scraper/fetchImage
 */
var Image = mongoose.model('Image', {
   url: { type: String, index: { unique: true }},
   type: String,
   data: Buffer
});

/**
 * /scraper/fetchImage
 * 
 * Retrieve image given its URL:
 * 
 * - If already cached in DB, return the stored data.
 * - Else download and store data in DB then return the downloaded data.
 * 
 * @param url URL of image to retrieve
 * 
 * @see Image
 */
app.get('/scraper/fetchImage', function(req, res) {
    var url = req.query.url;
    Image.findOne({url: url}, function(err, image) {
        if (err) throw err;
        
        if (image) {
            console.log("Found cached image", url, image.type, image.data.length);
            res.contentType(image.type);
            res.send(image.data);
            return;
        }
        
        request({url: url, encoding: 'binary'}, function (error, response, body) {
            if (!error && response.statusCode == 200) {
                console.log("Got remote image", url);
                var image = new Image;
                image.url = url;
                image.type = response.headers['content-type'];
                image.data = new Buffer(body, 'binary');
                image.save(function (err, image) {
                    if (err) throw err;
                    console.log("Saved image to MongoDB", url);
                });
            }
        }).pipe(res);
    });
});

/**
 * server
 * 
 * HTTP server instance.
 */
var server = app.listen(3000, function () {
  var host = server.address().address;
  var port = server.address().port;

  console.log('Grocery Stores app listening on http://%s:%s', host, port);
});
