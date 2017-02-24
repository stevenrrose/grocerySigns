/**
 * Add random PDF pages. Triggered by the infinite scroll mechanism  (spinning icon).
 * Each page element renders the /random.pdf file, which selects a random scrape permutation.
 */
function appendPages(nb) {
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
                appendPages(2);
            }
        });
    }
    
    // Add nb pages and render a random PDF within.
    for (var i = 0; i < nb; i++) {
        // Create page container.
        var page = $("<div class='page'></div>").addClass(pageFormatClass);
        $pages.append($("<div class='page-container col-xs-12 col-sm-6'></div>")
                .append($("<div class='thumbnail'></div>").append(page))
        );
                
        // Load a random PDF in the container.
        loadPDF('random.pdf?_='+Math.random(), page, {scale: 1});
    }
    
    // Move spinning icon to end of viewport.
    $("#pages-end").appendTo($pages);
}
