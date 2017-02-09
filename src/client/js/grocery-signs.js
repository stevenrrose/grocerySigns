/*
 *
 * Scraping.
 *
 */
 
/** Override default fetch URL. */
fetchUrl = "scraper/fetch";

/** Image fetch URL. */
var fetchImage = "scraper/fetchImage";


/*
 *
 * Algorithms and functions.
 *
 */

/**
 * Generate a random string.
 *
 *  @param size     Size of string to generate. Negative for alpha only.
 */
function randomStr(size) {
    var chars;
    if (size < 0) {
        // Alpha only.
        size = -size;
        chars = "abcdefghijklmnopqrstuvwxyz";
    } else {
        chars = "0123456789abcdefghijklmnopqrstuvwxyz";
    }
    var str = "";
    for (var i=0; i < size; i++) {
        str += chars[Math.floor(Math.random()*chars.length)];
    }
    return str;
}

/**
 *  Split string into sentences.
 *  
 *  @param text     String to split.
 */
function splitSentences(text) {
    return text.replace(/([!?]|\.\.\.)\s+/g, "$1. ").split(/[.;]\s/);
}


/*
 *
 * PDF Generation.
 *
 */

// PDF.js doesn't like concurrent workers so disable them. This will 
// generate 'Warning: Setting up fake worker.' on the console.
PDFJS.disableWorker = true;

/**
 *  Render PDF in a canvas using PDF.js.
 *  
 *  @param url          URL of PDF to render (supports blob and data URIs).
 *  @param container    Canvas container.
 *  @param options      Option object:
 *                      - scale: scale factor (default 2)
 *                      - url: if defined, wrap img tag into link with given href
 */
function renderPDF(url, container, options) {
    var options = options||{};
    
    PDFJS.getDocument(url).then(function(pdfDoc) {
        /* Only render the first page. */
        pdfDoc.getPage(1).then(function(page) {
            /* Compute ideal scaling factor: twice the page width for optimal subsampling. */
            var pageWidth = page.getViewport(1).width;
            var scale = options.scale || 2;
            scale *= $(container).width()/pageWidth;
            
            /* Create viewport and canvas. */
            var viewport = page.getViewport(scale);
            var canvas = document.createElement('canvas');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            //$(container).empty().append(canvas);

            /* Render page. */
            page.render({
                intent: print,
                canvasContext: canvas.getContext('2d'),
                viewport: viewport
            }).then(function() {
//              $(container).empty().append(canvas);
                var image = $("<img></img>").attr("src", canvas.toDataURL("image/png"));
                $(container).empty().append(image);
                if (options.url) {
                    image.wrap($("<a target='_blank'></a>").attr('href', options.url));
                }
            });
        });
    });
}

/**
 * Load & render a PDF in a canvas.
 * 
 *  @param url          URL of PDF to render (supports blob and data URIs).
 *  @param container    Canvas container.
 *  @param options      Option object:
 *                      - scale: scale factor (default 2)
 *                      
 *  @see renderPDF
 */
function loadPDF(url, container, options) {
    var options = options||{};
    
    // Don't render the remote URL directly, as we need access to the X-Scrape-URL response header,
    // used to link the rendered pages to the main app's matching scrape page. We also need the data
    // as a blob and not as a plain string for better performance, and since jQuery doesn't support 
    // that, then use plain XHR instead of $.ajax().
    // renderPDF("random.pdf", page, 1);
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'blob';
    xhr.onload = function(e) {
        if (this.status == 200) {
            // The scrape page is passed by the server as the X-Scrape-URL response header.
            options.url = this.getResponseHeader('X-Scrape-URL');

            // Pass the blob URL to PDF.js.
            var blob = this.response;
            var url = window.URL.createObjectURL(blob);

            renderPDF(url, container, options);
        }
    };
    xhr.send();
}


/*
 *
 * Interface functions.
 *
 */
 
/** Default page format class (see grocery-signs.css) */
var pageFormatClass = "page-us";

/** Delay for scheduled refresh events. */
var refreshDelay = 500; /*ms*/

/** Last scheduled refresh event. */
var refreshEvent = null;

/** Last scraped texts. */
var scrapedTexts = {};

/** Last loaded images. */
var loadedImages = [];

/** Last scraped images. */
var scrapedImages = [];

/**
 * Deferred loading of images.
 * 
 * @param {Object} state    State object with provider/id/images fields.
 * 
 * @see ImageFile
 */
function loadImages(state) {
    loadedImages = [];
    $.each(state.images||[], function(i, url) {
        if (url.match(/^data:/)) {
            // Don't load data URIs through the fetchImage proxy since we already have the data as base64.
            loadedImages[i] = new ImageFile(url, imageLoaded);
        } else {
            loadedImages[i] = new ImageFile(
                    fetchImage 
                    + "?url=" + encodeURIComponent(url) 
                    + "&provider=" + encodeURIComponent(state.provider)
                    + "&id=" + encodeURIComponent(state.id), 
                    imageLoaded);
        }
    });
}

/**
 *  Get file name for the given page.
 *  
 *  @param index    Page index.
 *  
 *  @see generatePDF()
 *  @see refreshFrame()
 */
function getFileName(index) {
    var templateName = $("#page-template-" + index).val();
    var color = $("input[name='page-color-" + index + "']:checked").val();
    if (color != "") {
        templateName += "-" + color;
    }
    
    if (!currentState || !currentState.id) {
        // Manual input.
        return templateName + ".pdf";
    }
    
    var components = [];
    components.push(currentState.provider);
    components.push(currentState.id);
    components.push(templateName);
    if (currentState.randomize) {
        components.push(currentState.seed);
    }
    return components.join('-') + '.pdf';
}

/**
 *  Download the PDF for the given page.
 *  
 *  @param index    Page index.
 *  
 *  @see generatePDF()
 *  @see getFileName()
 */
function downloadPDF(index) {
    var templateName = $("#page-template-" + index).val();
    var color = $("input[name='page-color-" + index + "']:checked").val();
    var fileName = getFileName(index);
    
    // Output to blob.
    var stream = blobStream();
    
    // Eventually download the blob as PDF.
    stream.on('finish', function() {
        saveAs(stream.toBlob('application/pdf'), fileName);
    });

    // Generate the PDF.
    generatePDF(stream, templates[templateName], scrapedTexts, scrapedImages, {color: color});
}

/**
 *  Refresh the PDF output frame.
 *  
 *  Typically called from input change event handlers.
 *  
 *  @param index    Page index.
 *  
 *  @see generatePDF()
 *  @see getFileName()
 */
function refreshFrame(index) {
    var container = $("#page-" + index);
    var templateName = $("#page-template-" + index).val();
    var color = $("input[name='page-color-" + index + "']:checked").val();
    var fileName = getFileName(index);
    
    // Output to blob.
    var stream = blobStream();
    
    // Eventually output the blob into given container.
    stream.on('finish', function() {
        // Get & remember blob object.
        var blob = stream.toBlob('application/pdf');
        $(container).data("blob", blob);
        
        // Clear previous blob URL and remember new one.
        var url = $(container).data("blobUrl");
        if (url) {
            window.URL.revokeObjectURL(url);
        }
        url = window.URL.createObjectURL(blob);
        $(container).data("blobUrl", url);

        // Render blob URL into container.
        renderPDF(url, container);
        
        // Set link attributes.
        var index = $(container).data("index");
        $("#page-download-" + index)
            .attr('href', url)
            .attr('target', '_blank')
            .attr('download', fileName);
    });

    // Generate the PDF.
    generatePDF(stream, templates[templateName], scrapedTexts, scrapedImages, {color: color});
}

/**
 *  Refresh all active pages.
 */
function refresh() {
    // Refresh scraped text array.
    $(".FIELD").each(function(i, e) {
        scrapedTexts[$(e).attr("id")] = $(e).val();
    });
    
    // Call refreshFrame on each active page.
    $(".page").each(function(index) {
        refreshFrame(index);
    });
}

/**
 *  Schedule a refresh event.
 *  
 *  This allows for interactive usage without having to recompute the whole UI at 
 *  each keypress.
 */
function scheduleRefresh() {
    if (refreshEvent) {
        clearTimeout(refreshEvent);
    }
    refreshEvent = setTimeout(function() {refresh(); refreshEvent = null;}, refreshDelay);
}

/**
 *  Update progress information during scraping.
 *
 *  @param step         Step (starts at 1).
 *  @param nbSteps      Total number of steps.
 *  @param stepLabel    Human-readable step label to display.
 */
function progress(step, nbSteps, stepLabel) {
    var percent = (step/(nbSteps+1))*100;
    $("#progress .progress-bar").attr('aria-valuenow', step).attr('aria-valuemax', nbSteps+1).attr('style','width:'+percent.toFixed(2)+'%').find("span").html(step + "/" + nbSteps);
    $("#progressStep").html(stepLabel);
}

/**
 *  Enable/disable interface.
 *
 *  @param enabled  Whether to enable or disable interface.
 *  @param modal    Modal dialog selector (defaults to '#progressDialog')
 */
function enableInterface(enabled, modal) {
    $(modal||"#progressDialog").modal(enabled?'hide':'show');
}

/**
 *  Display scraping result message.
 *  
 *  @param success  Whether the operation was successful.
 *  @param title    Message title.
 *  @param message  Message body.
 */
function displayMessage(success, title, message) {
    $("#parameters").append(
          "<div class='alert small alert-dismissible alert-" + (success ? "success" : "danger") + " fade in' role='alert'>"
        + "<button type='button' class='close' data-dismiss='alert' aria-label='Close'><span aria-hidden='true'>&times;</span></button>"
        + "<span class='glyphicon glyphicon-" + (success ? "ok" : "exclamation") + "-sign'></span> "
        + "<strong class='sr-only'>" + title + "</strong> "
        + message
        + "</div>"
    );
}

/**
 *  Populate fields 
 */
function populateFields() {
    var sentences;
    if (currentState.randomize) {
        // Shuffle sentences & images.
        sentences = shuffleSentences(currentState.sentences, currentState.seed);
        scrapedImages = shuffleImages(loadedImages, currentState.seed);
    } else {
        // Use sentences & images in order.
        sentences = currentState.sentences;
        scrapedImages = loadedImages;
    }

    // Populate fields with resulting values.
    $(".FIELD").each(function(i, e) {
        $(e).val(sentences[i]);
    });
}

/**
 *  Fetch item callback: display result in fields.
 *
 *  @param provider     Item provider descriptor.
 *  @param info         Item info.
 */
function fetchCallback(provider, info) {
    if (info.success) {
        // GA: successful scrape.
        ga('send', 'event', {
            eventCategory: 'Scraper',
            eventAction: 'success',
            eventLabel: provider.name + " ID=" + info.itemId,
            'dimension1': provider.name,
            'metric2': 1
        });
        
        // Success, gather & display item data.
        console.log("fetchCallback", info);      
        displayMessage(true, "Success!", provider.name + " ID = <a class='alert-link' target='_blank' href=\'" + info.url + "\'>" + info.itemId  + "</a>");
        
        var sentences = processSentences(info);
        var images = processImages(info);
        var seed = generateRandomSeed();
        
        // Bookmark result.
        bookmarkResult({
            provider: provider.name,
            id: info.itemId,
            seed: seed,
            sentences: sentences,
            images: images
        });
        
        // Update app state with new info.
        updateState({
            provider: provider.name,
            id: info.itemId,
            randomize: $("#randomize").prop('checked'),
            seed: seed,
            sentences: sentences,
            images: images
        });
    } else {
        // Failure.
        console.error("fetchCallback", info);      
        displayMessage(false, "Scraping failed!", provider.name + " ID = <a class='alert-link' target='_blank' href=\'" + info.url + "\'>" + info.itemId + "</a>");
    }

    // Done!
    enableInterface(true);
}

/**
 * Build sentences to populate fields with.
 * 
 * @param {Object} info scrape result
 * 
 * @returns {Array} array of normalized sentences
 */
function processSentences(info) {
    // Build sentences to populate fields with.
    // - title, vendor and price (even empty to ensure predictable order).
    var sentences = [
        normalizeString(info.title), 
        normalizeString(info.vendor), 
        normalizeString(info.price),
    ];
    // - nonempty feature bullet items.
    $.each(info.features||[], function(i, v) {
        v = normalizeString(v);
        if (v != "") sentences.push(v);
    });
    // - nonempty description sentences.
    $.each(info.description||[], function(i, v) {
        v = normalizeString(v);
        if (v != "") sentences.push(v);
    });
    // - nonempty review sentences.
    $.each(info.reviews||[], function(i, v) {
        v = normalizeString(v);
        if (v != "") sentences.push(v);
    });
    
    return sentences;
}

/**
 * Build list of images.
 * 
 * @param {Object} info scrape result
 * 
 * @returns {Array} array of normalized images
 */
function processImages(info) {
    var images = [];
    $.each(info.images||[], function(i, v) {
        if (v) images.push(v);
    });
    
    return images;
}

/**
 *  Search for random items and call fetchCallback() upon result.
 *  
 *  @param provider     Provider to scrape.
 */
function scrapeRandom(provider) {
    // Disable interface elements.
    enableInterface(false);
    
    // Generate random search string.
    var str = randomStr(provider.randomSearchStringLength);
    var label = provider.name + " items matching '" + str + "'";
    progress(1, 2, "Searching for " + provider.name + " items matching '" + str + "'...");

    // GA: scrape request.
    ga('send', 'event', {
        eventCategory: 'Scraper',
        eventAction: 'request',
        eventLabel: label,
        'dimension1': provider.name,
        'metric1': 1
    });

    provider.search(str, function(results) {
        if (!results || !results.length) {
            // No or invalid results.
            console.error("scrapeRandom", "Empty results");
            displayMessage(false, "Scraping failed!", provider.name + " search string = " + str);
            
            // Stop there.
            enableInterface(true);
            return;
        }
        
        // Pick & fetch a random item in the first result page.
        var index = Math.floor(Math.random()*results.length);
        var itemId = results[index].itemId;
        progress(2, 2, "Fetching " + provider.name + " item " + itemId + "...");
        provider.fetch(itemId, function(info) {fetchCallback(provider, info);});
    });
}

/**
 * Scrape item given its item ID.
 *  
 *  @param provider     Provider to scrape.
 *  @param itemId       Item ID of the item to scrape.
 */
function scrapeItem(provider, itemId) {
    // Disable interface elements.
    enableInterface(false);
    
    // Fetch given item.
    itemId = itemId.trim();
    progress(1, 1, "Fetching " + provider.name + " item " + itemId + "...");
    provider.fetch(itemId, function(info) {fetchCallback(provider, info);});
}

/**
 *  Scrape random data from the currently selected provider.
 */
function scrapeFields() {
    var provider = providers[$("#autofill-provider").val()];
    scrapeRandom(provider);
}

/**
 *  Called when random seed is changed by any means. Reshuffles fields & refresh pages.
 */
function seedChanged() {
    updateState($.extend({}, currentState, {randomize: $("#randomize").prop('checked'), seed: $("#seed").val()}));
}


/*
 * 
 * Bookmarks.
 * 
 */

/**
 * Bookmark the given result in DB for later retrieval.
 * 
 * @param info  Data to store.
 */
function bookmarkResult(info) {
    $.ajax({
        method: "POST",
        url: 'scraper/bookmark',
        processData: false,
        data: JSON.stringify(info),
        contentType: 'application/json',
        error: function(jqXHR, textStatus, errorThrown) {
            console.log("ajaxError", textStatus, errorThrown);
            displayMessage(false, "Ajax error!", "Ajax error: " + errorThrown);
        }
    });
}

/**
 * Bookmark the given seed in DB.
 * 
 * @param seed  Seed value.
 */
function bookmarkSeed() {
    console.log(currentState);
    if (!currentState || !currentState.id) {
        // No current state to bookmark.
        return;
    }
    var info = {
        provider: currentState.provider,
        id: currentState.id,
        seed: currentState.seed,
    };
    $.ajax({
        method: "POST",
        headers: {"X-Scrape-App": "Web"},
        url: 'scraper/bookmarkSeed',
        processData: false,
        data: JSON.stringify(info),
        contentType: 'application/json',
        success: function(data, textStatus, jqXHR) {
            // GA: saved permutation.
            ga('send', 'event', {
                eventCategory: 'Bookmark',
                eventAction: 'saved',
                eventLabel: currentState.provider + " ID=" + currentState.id + " seed=" + currentState.seed,
                'dimension1': currentState.name,
                'metric3': 1
            });
        },
        error: function(jqXHR, textStatus, errorThrown) {
            console.log("ajaxError", textStatus, errorThrown);
            displayMessage(false, "Ajax error!", "Ajax error: " + errorThrown);
        }
    });
}


/*
 *
 * State handling. 
 *
 */
 
/** Current hash, used for quick change detection. */
var currentHash = undefined;

/** Current state object. */
var currentState = undefined;

/**
 *  Update app state with given data.
 *  
 *  @param {object} state   State object.
 */
function updateState(state, replace) {
    // Compute hash from info.
    var hash = JSON.stringify(state);
    
    // No need to update everything if hash didn't change.
    if (currentHash == hash) return;
    
    $("#autofill-provider option[value='" + state.provider + "']").prop('selected', true);
    $("#randomize").prop('disabled', false).prop('checked', state.randomize).closest('label').removeClass('disabled');
    $("#seed, #genSeed, #bookmarkSeed").prop('disabled', !state.randomize);
    $("#seed").val(state.seed);
    if (typeof(currentState) === 'undefined' || JSON.stringify(state.images) !== JSON.stringify(currentState.images) /* FIXME: ugly but straightforward */) {
        loadImages(state);
    }
    $(".FIELD").prop('readonly', true);
    
    currentHash = hash;
    currentState = state;
    
    if (replace) {
        history.replaceState(state, null);
    } else {
        var components = [];
        components.push(state.provider);
        components.push(state.id);
        var url = '/' + components.join('/');

        if (state.randomize) {
            url += '?randomize=' + state.seed;
        }
        history.pushState(state, null, url);
    }
    
    computeActualMaxFieldLengths(state.seed);
    populateFields();
    refresh();
}

/** History state listener. */ 
window.onpopstate = function() {
    updateState(history.state, true);
};


$(document).ajaxError(function(event, jqXHR, ajaxSetting, thrownError) {
    console.log("ajaxError", thrownError);
    displayMessage(false, "Ajax error!", "Ajax error: " + thrownError);
    enableInterface(true);
});