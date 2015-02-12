/*
 *
 * Scraping functions.
 *
 */

/** Default fetch page proxy. */
var fetchUrl = "fetch.php";

/**
 * Pick & fetch a random product from a search result list.
 *
 *	@param results	Array of result objects (typically from search()).
 */
function fetchRandomSearchResult(results, callback) {
	console.log("results", results);
	var index = Math.floor(Math.random()*results.length);
	var asin = results[index].asin;
	console.log("=> index", index, asin);
	fetch(asin, callback);
}

/**
 * Generate a random string.
 *
 *	@param size		Size of string to generate.
 */
function randomStr(size) {
	var chars = "0123456789abcdefghijklmnopqrstuvwxyz";
	var str = "";
	for (var i=0; i < size; i++) {
		str += chars[Math.floor(Math.random()*chars.length)];
	}
	return str;
}

/**
 * Search for random Amazon products.
 */
function randomSearch() {
	var str = randomStr(4);
	search(str, function(results){fetchRandomSearchResult(results,function(data){console.log(data)})});
} 

// Test
function go1() {fetch("B0081L8QGK");fetch("B00CEZEIAC");fetch("B005HWUD26");fetch("B008I3QX6Q")}
function go2() {search("bzt", fetchRandomSearchResult);}


/*
 *
 * Interface functions.
 *
 */

/**
 * Update progress information during scraping.
 *
 *	@param step			Step (starts at 1).
 *	@param nbSteps		Total number of steps.
 *	@param stepLabel	Human-readable step label to display.
 */
function progress(step, nbSteps, stepLabel) {
    var percent = (step/(nbSteps+1))*100;
    $("#progress .progress-bar").attr('aria-valuenow', step).attr('aria-valuemax', nbSteps+1).attr('style','width:'+percent.toFixed(2)+'%').find("span").html(step + "/" + nbSteps);
    $("#progressStep").html(stepLabel);
}

/**
 * Enable/disable interface.
 *
 *	@param enabled	Whether to enable or disable interface.
 */
function enableInterface(enabled) {
	$("#scrapeRandom").prop('disabled', !enabled);
	$("#scrapeASIN").prop('disabled', !enabled);
	$("#progressDialog").modal(enabled?'hide':'show');
}

/**
 * Amazon product callback: display result in table.
 *
 *	@param info		Product info.
 *
 *	@see fetch()
 */
function fetchCallback(info) {
	if (info.success) {
		// Success, display product data.
		$("#results").find('tbody')
			.append($('<tr>')
				.append($('<td>').append($('<a target="_blank" href="' + info.url + '">').text(info.asin)))
				.append($('<td>').text(info.price))
				.append($('<td>').text(info.vendor))
				.append($('<td>').text(info.title))
			);
	} else {
		// Failure.
		$("#results").find('tbody')
			.append($('<tr class="danger">')
				.append($('<td>').append($('<a target="_blank" href="' + info.url + '">').text(info.asin)))
				.append($('<td>'))
				.append($('<td>'))
				.append($('<td>').text("Failure"))
			);
	}

	// Done!
	enableInterface(true);
}

/**
 * Search for random Amazon products and display results in table.
 */
function scrapeRandom() {
	// Disable interface elements.
	enableInterface(false);
	
	// Generate random search string.
	var str = randomStr(4);
	progress(1, 2, "Searching for products matching '" + str + "'...")
	search(str, function(results) {
		if (!results || !results.length) {
			// No or invalid results.
			$("#results").find('tbody')
				.append($('<tr class="danger">')
					.append($('<td>'))
					.append($('<td>'))
					.append($('<td>'))
					.append($('<td>').text("Empty results"))
				);
			
			// Stop there.
			enableInterface(true);
			return;
		}
		
		// Pick & fetch a random product in the first result page.
		var index = Math.floor(Math.random()*results.length);
		var asin = results[index].asin;
		progress(2, 2, "Fetching product " + asin + "...")
		fetch(asin, fetchCallback);
	});
}

/**
 * Scrape Amazon product given its ASIN.
 *
 *	@param asin		ASIN of the product to scrape.
 */
function scrapeASIN(asin) {
	// Disable interface elements.
	enableInterface(false);
	
	// Fetch given ASIN.
	asin = asin.trim();
	progress(1, 1, "Fetching product " + asin + "...")
	fetch(asin, fetchCallback);
}
