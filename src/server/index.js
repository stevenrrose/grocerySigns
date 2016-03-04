process.chdir(__dirname);

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
   seed: Number,
   sentences: [String],
   images: [String],
   bookmarks: [Number],
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
 * Store the posted JSON data into the *ScraperResult* collection.
 * 
 * @see ScraperResult
 */
app.post('/scraper/bookmark', function(req, res, next) {
    var result = new ScraperResult;
    result.provider = req.body.provider;
    result.id = req.body.id;
    result.seed = req.body.seed;
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
 * /scraper/bookmarkSeed
 * 
 * Bookmark the seed given in the posted JSON data into the 
 * *ScraperResult.bookmarks* subcollection.
 * 
 * @see ScraperResult
 */
app.post('/scraper/bookmarkSeed', function(req, res, next) {
    var provider = req.body.provider;
    var id = req.body.id;
    var seed = req.body.seed;
    
    // Add seed to the scraped result's bookmark set.
    ScraperResult.update({provider: provider, id: id}, {$addToSet: {bookmarks: seed}}, {multi: false}, function(err, result) {
        if (err) return next(err);
        
        if (!result) return next();

        if (result.nModified) {
            console.log("Bookmarked seed to MongoDB", req.body);
        }
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
        fields: templates.fields,
        templates: templates.templates,
        active_provider: provider,
    }));
});

/**
 * /:provider/:id?randomize={seed}
 * 
 * Static HTML page with input fields filled with scraped sentences, and 
 * permalinks to PDFs and thumbnails.
 */
app.get('/:provider/:id', function(req, res, next) {
    var provider = req.params.provider;
    var id = req.params.id;
    var randomize, seed;
    if (typeof(req.query.randomize) === 'undefined') {
        randomize = false;
    } else {
        randomize = true;
        seed = parseInt(req.query.randomize);
        if (isNaN(seed)) return next('Invalid seed');
    }
    
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
        
        seed = (randomize ? seed : result.seed);
        
        // Shuffle sentences.
        var sentences;
        if (randomize) {
            sentences = shuffleSentences(result.sentences, seed);
        } else {
            // Use sentences in order.
            sentences = result.sentences;
        }
        
        // Build state object.
        var state = {
            provider: provider,
            id: id,
            randomize: randomize,
            seed: seed,
            sentences: result.sentences,
            images: result.images,
            bookmarks: result.bookmarks,
        };
        
        // Build prev/next links if any.
        var prevLink, nextLink;
        if (result.bookmarks.length) {
            if (!randomize) {
                // Next is first entry in bookmarks.
                nextLink = provider + '/' + id + '?randomize=' + result.bookmarks[0];
            } else {
                // Find current seed in bookmarks list.
                var i = result.bookmarks.indexOf(seed);
                if (i != -1) {
                    // Found!
                    if (i == 0) {
                        // Prev is non-randomized page.
                        prevLink = provider + '/' + id;
                    } else {
                        prevLink = provider + '/' + id + '?randomize=' + result.bookmarks[i-1];
                    }
                    if (i < result.bookmarks.length-1) {
                        nextLink = provider + '/' + id + '?randomize=' + result.bookmarks[i+1];
                    }
                }
            }
        }
        
        // Render & return template.
        res.send(mainPageTpl({
            providers: providers, 
            fields: templates.fields,
            templates: templates.templates,
            active_provider: provider,
            active_sentences: sentences,
            active_state: state,
            state: JSON.stringify(state),
            prev: prevLink,
            next: nextLink,
        }));
    });
});

/**
 * /:provider/:id/:template.pdf?randomize={seed}
 * 
 * Permalinks to PDF (generated on the fly), crawlable from the HTML page.
 * 
 * TODO factorize code with HTML version
 */
app.get('/:provider/:id/:template.pdf', function(req, res, next) {
    var provider = req.params.provider;
    var id = req.params.id;
    var template = req.params.template;
    var randomize, seed;
    if (typeof(req.query.randomize) === 'undefined') {
        randomize = false;
    } else {
        randomize = true;
        seed = parseInt(req.query.randomize);
        if (isNaN(seed)) return next('Invalid seed');
    }
    
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
        
        seed = (randomize ? seed : result.seed);
        
        // Shuffle sentences.
        var sentences;
        if (randomize) {
            sentences = shuffleSentences(result.sentences, seed);
        } else {
            // Use sentences in order.
            sentences = result.sentences;
        }
        
        // Build field map.
        var fields = {};
        var i = 0;
        for (var field of templates.fields) {
            fields[field] = sentences[i++];
        }
        
        templates.computeActualMaxFieldLengths(seed);
        
        if (result.images.length == 0) {
            // No image.
            generatePDF(res, templates.templates[template], fields, []);
            return;
        }
        // Fetch all image URLs from DB.
        Image.find({url: {$in: result.images}}, function(err, results) {
            var images = [];
            if (!err && results) {
                // Ensure that images are in the same order as URLs.
                var imagesByUrl = {};
                for (image of results) {
                    console.log("Found cached image", image.url, image.type, image.data.length);
                    imagesByUrl[image.url] = {url: image.url, type: image.type, data: image.data};
                }
                for (url of result.images) {
                    images.push(imagesByUrl[url]);
                }
            }
            generatePDF(res, templates.templates[template], fields, images);
        });
    });
});

/**
 * /:provider/:id/:template.png
 * 
 * Permalinks to PDF thumbnails (generated on the fly), crawlable from the HTML page.
 */
app.get('/:provider/:id/:template.png', function(req, res, next) {
    //FIXME disabled until we can get the canvas module working.
    // https://github.com/Automattic/node-canvas/wiki/Installation---Windows
    // http://www.delarre.net/posts/installing-node-canvas-for-windows/
    return next();
    
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
        
        // Build sentence map.
        //TODO randomize
        var sentences = {};
        var i = 0;
        for (var field of templates.fields) {
            sentences[field] = result.sentences[i++];
        }
        
        if (result.images.length == 0) {
            // No image.
            generatePDF(res, templates.templates[template], sentences, []);
            return;
        }
        // Fetch all image URLs from DB.
        Image.find({url: {$in: result.images}}, function(err, results) {
            var images = [];
            if (!err && results) {
                // Ensure that images are in the same order as URLs.
                var imagesByUrl = {};
                for (image of results) {
                    console.log("Found cached image", image.url, image.type, image.data.length);
                    imagesByUrl[image.url] = {url: image.url, type: image.type, data: image.data};
                }
                for (url of result.images) {
                    images.push(imagesByUrl[url]);
                }
            }
            //FIXME use transform stream?
            var streamBuffers = require('stream-buffers');
            var stream = new streamBuffers.WritableStreamBuffer();
            stream.on('finish', function() {
                stream.end();
                
                // Generate PNG thumbnail.
                var Canvas = require('canvas');
                var PDFJS  = require('./pdf.js');
                PDFJS.disableWorker = true;
                PDFJS.getDocument(stream.getContents()).then(function(pdfDoc) {
                    /* Only render the first page. */
                    pdfDoc.getPage(1).then(function(page) {
                    /* Create viewport and canvas. */
                        var scale = 0.5;
                        var viewport = page.getViewport(scale);
                        var canvas = new Canvas(viewport.width, viewport.height);

                        /* Render page. */
                        page.render({
                            canvasContext: canvas.getContext('2d'),
                            viewport: viewport
                        }).then(function () {
                            canvas.pngStream().pipe(res);
                        }, function (err) {
                            console.log("Error generating PNG thumbnail", err);
                        });

                    });
                });
                
            });
            generatePDF(stream, templates.templates[template], sentences, images);
        });
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
