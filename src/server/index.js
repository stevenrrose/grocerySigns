process.chdir(__dirname);

var request = require('request');
var express = require('express');
var bodyParser = require('body-parser');
var swig = require('swig');

var scraper = require('./scraper.js');
var templates = require('./templates.js');

/**
 * 
 * DB stuff.
 * 
 */
var db = require('./db.js');
var Image = db.Image;
var ScraperResult = db.ScraperResult;
var Bookmark = db.Bookmark;

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
 * /sitemap.txt
 * 
 * Sitemap with all stored scrape pages.
 */
app.get('/sitemap.txt', function(req, res) {
    // All URLs must be full, so get the base URL from the request headers.
    var baseUrl = req.protocol + '://' + req.get('Host') + '/';
    
    // Stream over all stored scrapes.
    var stream = ScraperResult.find({}, 'provider id').stream();
    stream.on('error', function(err) {
        return next();
    });
    var first = true;
    stream.on('data', function(doc) {
        if (first) {
            // Write header and include the root URL.
            res.writeHead(200, {'Content-Type': 'text/plain'});
            res.write(baseUrl + '\n');
            first = false;
        }
        
        // Write scrape page URL.
        res.write(baseUrl + encodeURIComponent(doc.provider) + '/' + encodeURIComponent(doc.id) + '\n');
    });
    stream.on('close', function() {
        // Done.
        res.end();
    });
});

/**
 * /scraper/fetch?url={url}
 * 
 * Simple proxy for scraper, allow client-side code to bypass CORS restriction 
 * on remote sites.
 * 
 * @param url URL of page to retrieve
 */
app.get('/scraper/fetch', function(req, res, next) {
    // Validate provided URL against each provider's URL pattern.
    var url = req.query.url;
    console.log(url);
    for (var p in scraper.providers) {
        if (url.match(scraper.providers[p].urlPattern)) {
            // Matched! Fetch remote data.
            request(req.query.url).pipe(res);
            return;
        }
    }
    console.log("Rejecting URL " + url);
    return res.status(403).end();
});

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
    var provider = req.query.provider;
    var id = req.query.id;
    
    // Try to find existing image from its URL.
    Image.findOne({url: url}, function(err, image) {
        if (err) return next(err);
        
        if (image) {
            // Found!
            console.log("Found cached image", url, image.type, image.data.length);
            res.contentType(image.type);
            res.send(image.data);
            return;
        }
        
        // Ensure that the requested image belongs to the given provider/id scraper result,
        // to prevent abuse.
        ScraperResult.findOne({provider: provider, id: id}, function(err, result) {
            if (err) return next(err);

            if (!result || !result.images || result.images.indexOf(url) == -1) {
                console.log("Rejecting image " + url);
                return res.status(403).end();
            }
        
            // Image belongs to scraper result, fetch & store remote data.
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

    // Basic validation.
    try {
        result.provider = req.body.provider;
        if (!scraper.providers[result.provider]) throw "Unknown provider";

        result.id = req.body.id;
        if (result.id.length > 100) throw "ID too long";

        result.seed = parseInt(req.body.seed);
        if (isNaN(result.seed)) throw "Invalid seed";

        result.sentences = [];
        if (req.body.sentences) {
            for (sentence of req.body.sentences) {
                if (sentence) result.sentences.push(sentence.substr(0,100));
                if (result.sentences.length > 50) break;
            }
        }
            
        result.images = [];
        if (req.body.images) {
            for (image of req.body.images) {
                if (image) result.images.push(image);
                if (result.images.length > 5) break;
            }
        }
    } catch (e) {
        console.log(e);
        return res.status(400).end();
    }
        
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
 * @see Bookmark
 */
app.post('/scraper/bookmarkSeed', function(req, res, next) {
    var provider = req.body.provider;
    var id = req.body.id;
    var seed = req.body.seed;
    var caller = req.get('X-Scrape-App');
    
    // Basic validation.
    try {
        if (typeof(seed) !== 'undefined' && isNaN(seed)) throw "Invalid seed";
    } catch (e) {
        return res.status(400).end();
    }
    
    // Add to bookmark table.
    var bookmark = new Bookmark();
    bookmark.caller = caller;
    bookmark.provider = provider;
    bookmark.id = id;
    bookmark.seed = seed;
    bookmark.save(function (err) {
        if (err) {
            console.error("Error while saving bookmark to MongoDB");
        } else {
            console.log("Bookmark saved to MongoDB by caller app " + caller);
        }
    });
    
    if (typeof(seed) !== 'undefined') {
        // Add seed to the scraped result's bookmark set.
        ScraperResult.findOneAndUpdate({provider: provider, id: id}, {$addToSet: {bookmarks: seed}}, {multi: false}, function(err, result) {
            if (err) return next(err);

            if (!result) return next();

            if (result.nModified) {
                console.log("Bookmark added to scraper result in MongoDB", req.body);
            }
            res.send('OK');
        });
    } else {
        res.send('OK');
    }
});

/**
 * /history?since={date}&caller={string}
 * 
 * Return latest entries in the bookmarks table, optionnally since the given
 * date (excluded), most recent first.
 * 
 * @see Bookmark
 * @see /scraper/bookmarkSeed
 */
app.get('/history', function(req, res, next) {
    // Basic validation.
    var since = req.query.since;
    try {
        if (typeof(since) !== 'undefined' && isNaN(Date.parse(since))) throw "Unrecognized date format";
    } catch (e) {
        console.log(e);
        return res.status(400).end();
    }
    
    var caller = req.query.caller;
    
    var query = Bookmark.find()
            .select({_id: 0, date: 1, caller: 1, provider: 1, id: 1, seed: 1})
            .limit(100)
            .sort({date: -1});
    if (since) {
        query.where({date: {$gt: since}});
    }
    if (caller) {
        query.where({caller: caller});
    }
    query.exec(function(err, bookmarks) {
        if (err) return next(err);

        res.send(bookmarks);
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
    console.log(req.params);
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
 * /:provider/:id/:template.pdf?randomize={seed}&color={color}
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
    var options = {}
    if (typeof(req.query.color) !== 'undefined') {
        options.color = req.query.color;
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
        
        // Write header with canonical scrape URL.
        var scrapeURL = 
              '/' + encodeURIComponent(provider) 
            + '/' + encodeURIComponent(id);
        if (randomize) {
            scrapeURL += '?randomize=' + seed;
        }
        res.setHeader('X-Scrape-URL', scrapeURL);
        
        if (result.images.length == 0) {
            // No image.
            generatePDF(res, templates.templates[template], fields, [], options);
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
            generatePDF(res, templates.templates[template], fields, images, options);
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
 * randomPageTpl
 * 
 * Template file for /random HTML page.
 */
var randomPageTpl = swig.compileFile('../client/random.html');

/**
 * /random
 * 
 * Random page viewer.
 */
app.get('/random', function(req, res) {
    res.send(randomPageTpl());
});

/**
 * /random.pdf
 * 
 * Pick & redirect to random page.
 */
app.get('/random.pdf', function(req, res, next) {
    // Try to find scrape with nonempty bookmark list.
    var find = function() {
        // Random seed value used to select the scrape.
        var seed = generateRandomSeed();
        
        ScraperResult.findOne({seed: {$gte: seed}, $nor: [ {bookmarks: {$exists: false}}, {bookmarks: {$size: 0}} ]}, "provider id bookmarks", function(err, result) {
            if (err) return next(err);

            if (!result) {
                // Try again.
                find();
                return;
            }
            
            // Found, pick a random bookmarked seed.
            var params = {}
            params.provider = result.provider;
            params.id = result.id;
            params.seed = result.bookmarks[Math.floor(Math.random() * result.bookmarks.length)];
            
            // Choose random template and color.
            var templateNames = Object.keys(templates.templates);
            params.template = templateNames[Math.floor(Math.random() * templateNames.length)];
            var colors = ["black", "red", "blue"];
            params.color = colors[Math.floor(Math.random() * colors.length)];
            
            // Redirect to PDF permalink.
            var pdfURL = 
                      '/' + encodeURIComponent(params.provider) 
                    + '/' + encodeURIComponent(params.id)
                    + '/' + encodeURIComponent(params.template) + '.pdf'
                    + '?randomize=' + params.seed
                    + '&color=' + params.color;
            res.writeHead(307, {
                'Location': pdfURL,
                'Pragma': 'no-cache'
            });
            res.end();
        });
    };
    find();
});

/**
 * piFeedPageTpl
 * 
 * Template file for /pi-feed HTML page.
 */
var piFeedPageTpl = swig.compileFile('../client/pi-feed.html');

/**
 * /pi-feed
 * 
 * PI feed page viewer.
 */
app.get('/pi-feed', function(req, res) {
    res.send(piFeedPageTpl({
        templateNames: JSON.stringify(Object.keys(templates.templates)),
    }));
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
