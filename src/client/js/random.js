/**
 * Add random PDF pages. Triggered by the infinite scroll mechanism  (spinning icon).
 * Each page element renders the /random.pdf file, which selects a random scrape permutation.
 */
function appendPages() {
    var $pages = $("#pages");
    var nbPages = $("#pages .page").length;
    if (nbPages == 0) {
        // Add spînning icon; triggers appendPages() when visible.
        var end = $("<div id='pages-end' class='col-xs-12'><span class='icon icon-generate rotate-ccw'></span><span class='sr-only'>Loading...</span></div>");
        $pages.append(end);
        $(window).on('resize scroll', function() {
            var rect = end[0].getBoundingClientRect();
            if (rect.top < $(window).height()) {
                // Spinning icon is visible, append next page.
                appendPages();
            }
        });
    }
    
    // Add a couple of pages and render a random PDF within.
    for (var i = 0; i < 2; i++) {
        var page = $("<div class='page'></div>").addClass(pageFormatClass);
        $pages.append($("<div class='page-container col-xs-12 col-sm-6'></div>")
                .append($("<div class='thumbnail'></div>").append(page))
        );
        
        // Don't render the remote URL directly, as we need access to the X-Scrape-URL response header,
        // used to link the rendered pages to the main app's matching scrape page. We also need the data
        // as a blob and not as a plain string for better performance, and since jQuery doesn't support 
        // that, then use plain XHR instead of $.ajax().
        // renderPDF("random.pdf", page, 1);
        var xhr = new XMLHttpRequest();
        xhr.open('GET', 'random.pdf', true);
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
    
    // Move spinning icon to end of viewport.
    $("#pages-end").appendTo($pages);
}
