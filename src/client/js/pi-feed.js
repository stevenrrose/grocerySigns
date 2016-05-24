/** Max displayed pages upon first load. */
var maxFirstPages = 100;

/** Pages from the first batch waiting to be displayed with the "More results" button */
var lastResults = [];

/** Max displayed pages overall. */
var maxPages = 100;

/** Refresh interval (milliseconds). */
var refreshInterval = 1000;

/** Date of latest page from history. */
var latestPageDate = null;

/**
 * Add PDF pages generated from Pi script in real-time.
 */
function refreshPages() {
    // Get new pages from history.
    var xhr = new XMLHttpRequest();
    var url = 'history?caller=Pi';
    if (latestPageDate) {
        // Only get the newest entries since last request.
        url += '&since=' + latestPageDate;
    }
    xhr.open('GET', url, true);
    xhr.responseType = 'json';
    xhr.onload = function(e) {
        if (this.status == 200) {
            // Limit first batch of pages.
            var results = this.response;
            if (!latestPageDate) {
                // First batch: only display the first *maxFirstPages* and
                // remember the remaining ones for on-demand loading.
                results = this.response.slice(0, maxFirstPages);
                lastResults = this.response.slice(maxFirstPages);
                
                if (lastResults.length > 0) {
                    // Add "More results" button.
                    var more = $("<div id='pages-end' class='col-xs-12'><button type='button' class='btn btn-default btn-round' onclick='moreResults()'>More results <span class='icon icon-generate'></span></button></div>");
                    $("#pages").append(more);
                }
            }
            
            if (results.length) {
                // Remember latest page date.
                latestPageDate = results[0].date;

                addPages(results);
            }
                
            // Schedule new refresh.
            setTimeout(refreshPages, refreshInterval);
        }
        
        // Limit overall number of pages.
        $("#pages > :nth-child(n+" + (maxPages+1) + ")").remove();
    };
    xhr.send();
}

/**
 * Add new PDF pages.
 * 
 * @param results   List of history entries to add.
 * @param end       If false, prepend pages to beginning of list, else append to end.
 */
function addPages(results, end) {
    var $pages = $("#pages");
    
    for (var i = 0; i < results.length; i++) {
        // Create page container.
        var page = $("<div class='page'></div>").addClass(pageFormatClass);
        
        var params;
        var container = $("<div class='page-container col-xs-12 col-sm-6'></div>")
                    .append($("<div class='thumbnail'></div>").append(page));
        if (end) {
            // Append to end of page list.
            $pages.append(container);
            params = results[i];
        } else {
            // Prepend to beginning of page list.
            $pages.prepend(container);
            params = results[results.length-i-1];
        }

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

        // Load the PDF in the container.
        loadPDF(pdfURL, page, {scale: 1});
    }
}

/**
 * Display more results from initial batch.
 */
function moreResults() {
    if (lastResults.length > 0) {
        addPages(lastResults.slice(0, maxFirstPages), true);
        lastResults = lastResults.slice(maxFirstPages);
        if (lastResults.length > 0) {
            $("#pages-end").appendTo($("#pages"));
        } else {
            $("#pages-end").remove();
        }
    }
}
