var request = require('request');
var express = require('express');
var bodyParser = require('body-parser');
var swig = require('swig');
var mongoose = require('mongoose');

var Schema = mongoose.Schema;
mongoose.connect('mongodb://localhost/grocery-signs');

var scraper = require('./scraper.js');
var templates = require('./templates.js');

/**
 * providers
 * 
 * Provider list.
 */
var providers = Object.keys(scraper.providers);

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
app.use('/js', express.static(__dirname + '/../common'));
app.use(express.static(__dirname + '/../templates'));
app.use('/scraper', express.static(__dirname + '/../scraper'));

/**
 * /scraper/fetch?url={url}
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
 * @see /scraper/fetchImage?url={url}
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
 * /scraper/fetchImage?url={url}
 * 
 * Retrieve image given its URL:
 * 
 * - If already cached in the *Image* collection, return the stored data.
 * - Else download and store data in the *Image* collection then return the 
 *   downloaded data.
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

/**
 * /scraper/bookmark
 * 
 * Stores the posted JSON data into the *ScraperResult* collection.
 * 
 * @param {type} param1
 * @param {type} param2
 * 
 * @see ScraperResult
 */
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
 * mainPageTpl
 * 
 * Template file for main HTML page.
 */
var mainPageTpl = swig.compileFile('../client/grocery-signs.html');

/**
 * /
 * 
 * Application root.
 */
app.get('/', function(req, res) {
//  res.sendFile('/client/grocery-signs.html', {root: __dirname + '/..'});
    res.send(mainPageTpl({
        providers: providers, 
        fields: templates.fields,
        templates: templates.templates,
    }));
});

/**
 * /:provider
 * 
 * Main page with given provider pre-selected.
 */
app.get('/:provider', function(req, res, next) {
    var provider = req.params.provider;
    
    if (!providers.find(function(e) {return (e == provider);})) {
        // No such provider.
        return next();
    }
    
    // Generate page with provider pre-selected.
    res.send(mainPageTpl({
        providers: providers, 
        active_provider: provider,
        fields: templates.fields,
        templates: templates.templates,
    }));
});

/**
 * /:provider/:id
 * 
 * Static HTML page with input fields filled with scraped sentences, and 
 * permalinks to PDFs and thumbnails.
 */
app.get('/:provider/:id', function(req, res, next) {
    var provider = req.params.provider;
    var id = req.params.id;
    
    if (!providers.find(function(e) {return (e == provider);})) {
        // No such provider.
        return next();
    }
    
    // Try to find scraped result for the given provider/id.
    ScraperResult.findOne({provider: provider, id: id}, function(err, result) {
        if (err) return next(err);
        
        if (!result) return next();

        // Found! Generate page with scraped data.
        console.log("Found cached scraper result", provider, id);
        res.send(mainPageTpl({
            providers: providers, 
            active_provider: provider,
            fields: templates.fields,
            templates: templates.templates,
            sentences: result.sentences,
            images: JSON.stringify(result.images),
        }));
    });
});

/**
 * /:provider/:id/:template.pdf
 * 
 * Permalinks to PDF (generated on the fly), crawlable from the HTML page.
 */
app.get('/:provider/:id/:template.pdf', function(req, res, next) {
    var provider = req.params.provider;
    var id = req.params.id;
    var template = req.params.template;
    
    if (!providers.find(function(e) {return (e == provider);})) {
        // No such provider.
        return next();
    }
    if (!templates.templates[template]) {
        // No such template.
        return next();
    }
    
    // Try to find scraped result for the given provider/id.
    ScraperResult.findOne({provider: provider, id: id}, function(err, result) {
        if (err) return next(err);
        
        if (!result) return next();

        // Found! Generate PDF with scraped data.
        console.log("Found cached scraper result", provider, id);
        
        var sentences = {};
        var i = 0;
        for (var field of templates.fields) {
            sentences[field] = result.sentences[i++];
        }
        
        //TODO ImageFile from URLs.
        
        generatePDF(res, templates.templates[template], sentences, result.images);
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
