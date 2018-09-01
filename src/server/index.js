(async() => {

process.chdir(__dirname);

var express = require('express');
var bodyParser = require('body-parser');
var swig = require('swig');
var puppeteer = require('puppeteer');

var scraper = require('./scraper.js');
var templates = require('./templates.js');

/*
 *
 * Headless Chrome.
 * 
 */

const browser = await puppeteer.launch({args: ['--no-sandbox', '--disable-setuid-sandbox']});
// Change the user agent to fix issue with fonts: headless loads TTF instead
// of woff2 and setst the wrong unicodeRange.
let agent = await browser.userAgent();
agent = agent.replace("HeadlessChrome", "Chrome");

/*
 * Outgoing requests.
 */

var request = require('request').defaults({
    timeout: 10000, /* ms */
    headers: {
//        'User-Agent': agent /* Same as Chrome instance above */
    }
});

// Used to debug outgoing requests.
// request.debug = true;

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
app.get('/sitemap.txt', (req, res) => {
    // All URLs must be full, so get the base URL from the request headers.
    var baseUrl = req.protocol + '://' + req.get('Host') + '/';
    
    // Stream over all stored scrapes.
    var stream = ScraperResult.find({}, 'provider id').stream();
    stream.on('error', err => {
        return next();
    });
    var first = true;
    stream.on('data', doc => {
        if (first) {
            // Write header and include the root URL.
            res.writeHead(200, {'Content-Type': 'text/plain'});
            res.write(baseUrl + '\n');
            first = false;
        }
        
        // Write scrape page URL.
        res.write(baseUrl + encodeURIComponent(doc.provider) + '/' + encodeURIComponent(doc.id) + '\n');
    });
    stream.on('close', () => {
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
app.get('/scraper/fetch', (req, res, next) => {
    // Validate provided URL against each provider's URL pattern.
    var url = req.query.url;
    console.log("Fetching URL", url);
    for (var p in scraper.providers) {
        if (url.match(scraper.providers[p].urlPattern)) {
            // Matched! Fetch remote data.
            request(req.query.url).pipe(res);
            return;
        }
    }
    console.warn("Rejecting URL", url);
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
app.get('/scraper/fetchImage', async (req, res, next) => {
    var url = req.query.url;
    var provider = req.query.provider;
    var id = req.query.id;
    
    // Try to find existing image from its URL.
    const image = await Image.findOne({url: url});
    if (image) {
        // Found!
        console.log("Found cached image", {url, type: image.type, length: image.data.length});
        res.contentType(image.type);
        res.send(image.data);
        return;
    }
    
    // Ensure that the requested image belongs to the given provider/id scraper result,
    // to prevent abuse.
    const result = await ScraperResult.findOne({provider: provider, id: id});
    if (!result || !result.images || result.images.indexOf(url) === -1) {
        console.warn("Rejecting image", url);
        return res.status(403).end();
    }

    // Image belongs to scraper result, fetch & store remote data.
    request({url: url, encoding: 'binary'}, async (error, response, body) => {
        if (!error && response.statusCode === 200) {
            console.log("Got remote image", url);
            var image = new Image;
            image.url = url;
            image.type = response.headers['content-type'];
            image.data = new Buffer(body, 'binary');
            await image.save();
            console.log("Saved image to MongoDB", url);
        } else {
            console.error("Error while fetching image", {url, error});
            return res.status(400).end();
        }
    }).pipe(res);
});

/**
 * Get cached data for given images.
 * 
 * @param {*} images List of image URLs.
 * @param {*} base64 Whether to return data in raw or base-64 format.
 */
async function getCachedImages(images, base64) {
    if (images.length === 0) {
        return [];
    }
    const results = [];
    const cachedImages = await Image.find({url: {$in: images}});
    if (cachedImages) {
        // Ensure that images are in the same order as URLs.
        var imagesByUrl = {};
        for (image of cachedImages) {
            console.log("Found cached image", {url: image.url, type: image.type, length: image.data.length});
            if (base64) {
                var data = 'data:' + image.type + ';base64,' + Buffer.from(image.data).toString('base64');
                imagesByUrl[image.url] = {url: image.url, type: image.type, data: data};
            } else {
                imagesByUrl[image.url] = {url: image.url, type: image.type, data: image.data};
            }
        }
        for (url of images) {
            results.push(imagesByUrl[url]);
        }
    }
    return results;
}

/**
 * /scraper/bookmark
 * 
 * Store the posted JSON data into the *ScraperResult* collection.
 * 
 * @see ScraperResult
 */
app.post('/scraper/bookmark', async (req, res, next) => {
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
        return res.status(400).end();
    }
        
    try {
        await result.save();
        console.log("Saved scraper result to MongoDB", {provider: req.body.provider, id: req.body.id, seed: req.body.seed});
        res.location('/' + req.body.provider + '/' + req.body.id);
        res.send('OK');
    } catch(err) {
        console.error("Error while saving scraper result to MongoDB", err);
        return res.status(400).end();
    };
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
app.post('/scraper/bookmarkSeed', async (req, res, next) => {
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
    try {
        await bookmark.save();
        console.log("Bookmark saved to MongoDB", {caller, provider, id, seed});

        if (typeof(seed) !== 'undefined') {
            // Add seed to the scraped result's bookmark set.
            const result = await ScraperResult.findOneAndUpdate({provider: provider, id: id}, {$addToSet: {bookmarks: seed}}, {multi: false});
            if (!result) return next();

            if (result.nModified) {
                console.log("Bookmark added to scraper result in MongoDB", {provider, id, seed});
            }
        }
        res.send('OK');
    } catch(err) {
        console.error("Error while saving bookmark to MongoDB", err);
        return res.status(400).end();
    };
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
app.get('/history', async (req, res, next) => {
    // Basic validation.
    var since = req.query.since;
    try {
        if (typeof(since) !== 'undefined' && isNaN(Date.parse(since))) throw "Unrecognized date format";
    } catch (e) {
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
    const bookmarks = await query.exec();
    res.send(bookmarks);
});

/**
 * Select random scrape among bookmark results.
 */
async function findRandomScrape() {
    // Random seed value used to select the scrape.
    var seed = generateRandomSeed();
    
    // Try to find scrape with nonempty bookmark list.
    const result = await ScraperResult.findOne({seed: {$gte: seed}, $nor: [ {bookmarks: {$exists: false}}, {bookmarks: {$size: 0}} ]}, "provider id bookmarks");
    if (!result) {
        // Try again.
        return findRandomScrape();
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

    return params;
}

/**
 * Get page generation parameters from bookmark.
 */
async function getBookmarkParameters(provider, id, template, randomize, seed, options) {
    if (!providers.find(function(e) {return (e === provider);})) {
        // No such provider.
        throw "No such provider";
    }
    if (!templates.templates[template]) {
        // No such template.
        throw "No such template";
    }
    
    // Try to find scraped result for the given provider/id.
    const result = await ScraperResult.findOne({provider: provider, id: id});
    if (!result) {
        throw "No available result";
    }

    // Found! Get scraped data.
    console.log("Found cached scraper result", {provider, id});
    
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
    
    // Fetch all image URLs from DB.
    const images = await getCachedImages(result.images, true);

    return {
        template: template,
        seed: seed,
        fields: fields,
        images: images,
        options: options
    };
}

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
app.get('/', (req, res) => {
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
app.get('/:provider', (req, res, next) => {
    var provider = req.params.provider;
    
    if (!providers.find(function(e) {return (e === provider);})) {
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
app.get('/:provider/:id', async (req, res, next) => {
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
    
    if (!providers.find(function(e) {return (e === provider);})) {
        // No such provider.
        return next();
    }
    
    // Try to find scraped result for the given provider/id.
    const result = await ScraperResult.findOne({provider: provider, id: id});
    if (!result) return next();

    // Found! Generate page with scraped data.
    console.log("Found cached scraper result", {provider, id});
    
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
                if (i === 0) {
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

/**
 * /:provider/:id/:template.pdf?randomize={seed}&color={color}
 * 
 * Permalinks to PDF (client-side generated on the fly), crawlable from the HTML
 * page. Uses Headless Chrome to convert SVG to PDF. 
 */
app.get('/:provider/:id/:template.pdf', async (req, res, next) => {
    const templateName = req.params.template;
    if (!templates.templates[templateName]) {
        // No such template.
        return next();
    }
    const template = templates.templates[templateName];

    // Forward to SVG version and convert to PDF.
    const url = req.originalUrl.replace(".pdf", ".svg");
    const browserPage = await browser.newPage();
    await browserPage.setUserAgent(agent);
    const response = await browserPage.goto('http://localhost:3000' + url, {waitUntil: 'networkidle0'});// FIXME URL
    if (!response.ok()) {
        return next();
    }
    res.set('Content-Type', 'application/pdf');
    res.set('X-Scrape-URL', response.headers()['x-scrape-url'])
    res.send(await browserPage.pdf({width: template.width, height: template.height, pageRanges: '1'}));
});

/**
 * /:provider/:id/:template.old.pdf?randomize={seed}&color={color}
 * 
 * PDFKitbased PDF generation.
 */
app.get('/:provider/:id/:template.old.pdf', async (req, res, next) => {
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
    
    if (!providers.find(function(e) {return (e === provider);})) {
        // No such provider.
        return next();
    }
    if (!templates.templates[template]) {
        // No such template.
        return next();
    }
    
    // Try to find scraped result for the given provider/id.
    const result = await ScraperResult.findOne({provider: provider, id: id});
    if (!result) return next();

    // Found! Generate PDF with scraped data.
    console.log("Found cached scraper result", {provider, id});
    
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
    
    // Fetch all image URLs from DB.
    const images = await getCachedImages(result.images);

    // Generate PDF.
    generatePDF(res, templates.templates[template], fields, images, options);
});

/**
 * svgPageTpl
 * 
 * Template file for *.svg HTML page.
 */
var svgPageTpl = swig.compileFile('../client/svg.html');

/**
 * /templates/:template.pdf?parameters={parameters}
 * 
 * On-demand PDF generation from parameters.
 */
app.get('/templates/:template.pdf', async (req, res, next) => {
    const templateName = req.params.template;
    if (!templates.templates[templateName]) {
        // No such template.
        return next();
    }
    const template = templates.templates[templateName];

    // Forward to SVG version and convert to PDF.
    const url = req.originalUrl.replace(".pdf", ".svg");
    const browserPage = await browser.newPage();
    await browserPage.setUserAgent(agent);
    const response = await browserPage.goto('http://localhost:3000' + url, {waitUntil: 'networkidle0'});// FIXME URL
    res.set('Content-Type', 'application/pdf');
    res.send(await browserPage.pdf({width: template.width, height: template.height, pageRanges: '1'}));
});

/**
 * /templates/:template.svg?parameters={parameters}
 * 
 * On-demand SVG page generation from parameters.
 */
app.get('/templates/:template.svg', async (req, res, next) => {
    const template = req.params.template;
    const parameters = JSON.parse(req.query.parameters);
    if (!templates.templates[template]) {
        // No such template.
        return next();
    }

    // Generate SVG page.
    res.send(svgPageTpl({ parameters : JSON.stringify({
        template: template,
        seed: parameters.seed,
        fields: parameters.fields,
        images: parameters.images,
        options: parameters.options
    })}));
});

/**
 * /:provider/:id/:template.svg?randomize={seed}&color={color}
 * 
 * Permalinks to SVG (client-side generated on the fly).
 * 
 * TODO factorize code with HTML version
 */
app.get('/:provider/:id/:template.svg', async (req, res, next) => {
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

    try {
        // Get parameters from bookmark.
        const parameters = await getBookmarkParameters(provider, id, template, randomize, seed, options);
        
        // Write header with canonical scrape URL.
        var scrapeURL = 
              '/' + encodeURIComponent(provider) 
            + '/' + encodeURIComponent(id);
        if (randomize) {
            scrapeURL += '?randomize=' + seed;
        }
        res.setHeader('X-Scrape-URL', scrapeURL);
        
        // Generate & return SVG page.
        res.send(svgPageTpl({ parameters : JSON.stringify(parameters)}));
    } catch (error) {
        return next(error);
    }
});

/**
 * /:provider/:id/:template.json?randomize={seed}&color={color}
 * 
 * Permalinks to page parameters.
  */
app.get('/:provider/:id/:template.json', async (req, res, next) => {
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

    try {
        // Get parameters from bookmark.
        const parameters = await getBookmarkParameters(provider, id, template, randomize, seed, options);
        
        // Write header with canonical scrape URL.
        var scrapeURL = 
              '/' + encodeURIComponent(provider) 
            + '/' + encodeURIComponent(id);
        if (randomize) {
            scrapeURL += '?randomize=' + seed;
        }
        res.setHeader('X-Scrape-URL', scrapeURL);

        // Return parameters as JSON.
        res.json(parameters).end();
    } catch (error) {
        return next(error);
    }
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
app.get('/random', (req, res) => {
    res.send(randomPageTpl());
});

/**
 * /random.pdf
 * 
 * Pick & redirect to random PDF page.
 */
app.get('/random.pdf', async (req, res, next) => {
    const params = await findRandomScrape();
    
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

/**
 * /random.pdf
 * 
 * Pick & redirect to random SVG page.
 */
app.get('/random.svg', async (req, res, next) => {
    const params = await findRandomScrape();
    
    // Redirect to SVG permalink.
    var svgURL = 
                '/' + encodeURIComponent(params.provider) 
            + '/' + encodeURIComponent(params.id)
            + '/' + encodeURIComponent(params.template) + '.svg'
            + '?randomize=' + params.seed
            + '&color=' + params.color;
    res.writeHead(307, {
        'Location': svgURL,
        'Pragma': 'no-cache'
    });
    res.end();
});

/**
 * /random.json
 * 
 * Pick & return random page parameters.
 */
app.get('/random.json', async (req, res, next) => {
    const params = await findRandomScrape();

    try {
        // Get parameters from bookmark.
        const parameters = await getBookmarkParameters(params.provider, params.id, params.template, true, params.seed, {color: params.color});
        
        // Write header with canonical scrape URL.
        var scrapeURL = 
              '/' + encodeURIComponent(params.provider) 
            + '/' + encodeURIComponent(params.id)
            + '?randomize=' + params.seed;
        res.setHeader('X-Scrape-URL', scrapeURL);

        // Return parameters as JSON.
        res.json(parameters).end();
    } catch (error) {
        return next(error);
    }
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
app.get('/pi-feed', (req, res) => {
    res.send(piFeedPageTpl({
        templateNames: JSON.stringify(Object.keys(templates.templates)),
    }));
});

/**
 * server
 * 
 * HTTP server instance.
 */
var server = app.listen(3000, () => {
  var host = server.address().address;
  var port = server.address().port;

  console.log('Grocery Stores app listening on http://%s:%s', host, port);
});

})();
