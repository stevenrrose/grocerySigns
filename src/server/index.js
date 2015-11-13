var request = require('request');
var express = require('express');
var bodyParser = require('body-parser');
var swig = require('swig');
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
mongoose.connect('mongodb://localhost/grocery-signs');

/**
 * app
 * 
 * Main Express router instance. 
 */
var app = express();
app.use(bodyParser.json());

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
var imageSchema = new Schema({
   url: { type: String, index: { unique: true }},
   type: String,
   data: Buffer
});
var Image = mongoose.model('Image', imageSchema);

/**
 * ScraperResult
 * 
 * Mongoose model for scraper results.
 * 
 * @property provider data provider Id (e.g. 'OkCupid')
 * @property id provider-local page ID (e.g. 'hotgirl90')
 * @property sentences array of strings from scraped page
 * @property images array of image URLs from scraped page
 * 
 * @see /scraper/bookmark
 */
var scraperResultSchema = new Schema({
   provider: String,
   id: String,
   sentences: [String],
   images: [String]
});
scraperResultSchema.index({provider: 1, id: 1}, { unique: true });
var ScraperResult = mongoose.model('ScraperResult', scraperResultSchema);

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
app.get('/scraper/fetchImage', function(req, res, next) {
    var url = req.query.url;
    Image.findOne({url: url}, function(err, image) {
        if (err) return next(err);
        
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
                image.save(function (err) {
                    if (err) return next(err);
                    console.log("Saved image to MongoDB", url);
                });
            }
        }).pipe(res);
    });
});

app.post('/scraper/bookmark', function(req, res, next) {
    var result = new ScraperResult;
    result.provider = req.body.provider;
    result.id = req.body.id;
    result.sentences = req.body.sentences;
    result.images = req.body.images;
    result.save(function (err) {
        if (err) return next(err);
        console.log("Saved scraper result to MongoDB", req.body);
        res.location('/' + req.body.provider + '/' + req.body.id);
        res.send('OK');
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
