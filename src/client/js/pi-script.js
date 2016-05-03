/** Max displayed pages upon first load. */
var maxFirstPages = 10;

/** Max displayed pages overall. */
var maxPages = 100;

/** Refresh interval (milliseconds). */
var refreshInterval = 1000;

/** Date of latest page from history. */
var latestPage = null;

/**
 * Add PDF pages generated from Pi script in real-time.
 */
function refreshPages() {
    var $pages = $("#pages");
    
    // Get new pages from history.
    var xhr = new XMLHttpRequest();
    var url = 'history';
    if (latestPage) {
        url += '?since=' + latestPage;
    }
    xhr.open('GET', url, true);
    xhr.responseType = 'json';
    xhr.onload = function(e) {
        if (this.status == 200) {
            // Limit first batch of pages.
            var nb = this.response.length;
            if (!latestPage && nb > maxFirstPages) {
                nb = maxFirstPages;
            }
            
            // Iterate over newest history entries.
            for (var i = nb-1; i >= 0; i--) {
                var params = this.response[i];
                
                // Remember latest page date.
                latestPage = params.date;
                
                // Create page container.
                var page = $("<div class='page'></div>").addClass(pageFormatClass);
                $pages.prepend($("<div class='page-container col-xs-12 col-sm-6'></div>")
                        .append($("<div class='thumbnail'></div>").append(page))
                );
        
                // Choose random template and color.
                params.template = templateNames[Math.floor(Math.random() * templateNames.length)];
                var colors = ["black", "red", "blue"];
                params.color = colors[Math.floor(Math.random() * colors.length)];
                var pdfURL = 
                                encodeURIComponent(params.provider) 
                        + '/' + encodeURIComponent(params.id)
                        + '/' + encodeURIComponent(params.template) + '.pdf'
                        + '?randomize=' + params.seed
                        + '&color=' + params.color;
                
                // Don't render the remote URL directly, as we need access to the X-Scrape-URL response header,
                // used to link the rendered pages to the main app's matching scrape page. We also need the data
                // as a blob and not as a plain string for better performance, and since jQuery doesn't support 
                // that, then use plain XHR instead of $.ajax().
                // renderPDF("random.pdf", page, 1);
                var xhr = new XMLHttpRequest();
                xhr.open('GET', pdfURL, true);
                xhr.responseType = 'blob';
                xhr.targetPage = page; // Needed for some reason; using the page var directly doesn't work in the callback.
                xhr.onload = function(e) {
                    if (this.status == 200) {
                        // The scrape page is passed by the server as the X-Scrape-URL response header.
                        var scrapeURL = this.getResponseHeader('X-Scrape-URL');

                        // Pass the blob URL to PDF.js.
                        var blob = this.response;
                        var url = window.URL.createObjectURL(blob);

                        renderPDF(url, this.targetPage, {scale: 1, url: scrapeURL});
                    }
                };
                xhr.send();
            }
            
            // Schedule new refresh.
            setTimeout(refreshPages, refreshInterval);
        }
        
        // Limit overall number of pages.
        $("#pages > :nth-child(n+" + (maxPages+1) + ")").remove();
    };
    xhr.send();
}
