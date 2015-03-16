/*
 *
 * Scraping functions.
 *
 */

/** Default fetch page proxy. */
var fetchUrl = "fetch.php";

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
 *  Split string into sentences.
 *  
 *  @param text		String to split.
 */
function splitSentences(text) {
	return text.replace(/([!?]|\.\.\.)\s+/g, "$1. ").split(/[.;]\s/);
}


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
	$("#progressDialog").modal(enabled?'hide':'show');
}

/**
 * Fetch product callback: display result in table.
 *
 *	@param provider		Product provider descriptor.
 *	@param info			Product info.
 */
function fetchCallback(provider, info) {
	console.log(info);		
	var body = $("#results").find('tbody');
	if (info.success) {
		// Success, display product data.
		body
			.append($('<tr>')
				.append($('<td>').text(provider.name))
				.append($('<td>').append($('<a target="_blank" href="' + info.url + '">').text(info.itemId)))
				.append($('<td>').text(info.price))
				.append($('<td>').text(info.vendor))
				.append($('<td>').text(info.title))
			)
			.append($('<tr>')
				.append($('<td>'))
				.append($('<td colspan="4">').text(info.features))
			)
			.append($('<tr>')
				.append($('<td>'))
				.append($('<td colspan="4">').text(info.description))
			);
		if (info.images && info.images.length > 0) {
			body.append($('<tr>')
				.append($('<td>'))
				.append($('<td colspan="4">').append($('<img src="' + info.images[0] + '">')))
			);
		}
	} else {
		// Failure.
		body
			.append($('<tr class="danger">')
				.append($('<td>').text(provider.name))
				.append($('<td>').append($('<a target="_blank" href="' + info.url + '">').text(info.itemId)))
				.append($('<td colspan="2">'))
				.append($('<td>').text("Failure"))
			);
	}

	// Done!
	enableInterface(true);
}

/**
 * Search for random products and display results in table.
 */
function scrapeRandom() {
	var provider = providers[$("#provider").val()];

	// Disable interface elements.
	enableInterface(false);
	
	// Generate random search string.
	var str = randomStr(provider.randomSearchStringLength);
	progress(1, 2, "Searching for " + provider.name + " products matching '" + str + "'...")
	provider.search(str, function(results) {
		if (!results || !results.length) {
			// No or invalid results.
			$("#results").find('tbody')
				.append($('<tr class="danger">')
					.append($('<td>').text(provider.name))
					.append($('<td colspan="3">'))
					.append($('<td>').text("Empty results for search string '" + str + "'"))
				);
			
			// Stop there.
			enableInterface(true);
			return;
		}
		
		// Pick & fetch a random product in the first result page.
		var index = Math.floor(Math.random()*results.length);
		var itemId = results[index].itemId;
		progress(2, 2, "Fetching " + provider.name + " product " + itemId + "...");
		provider.fetch(itemId, function(info) {fetchCallback(provider, info);});
	});
}

/**
 * Scrape product given its item ID.
 */
function scrapeItem() {
	var provider = providers[$("#provider").val()];
	var itemId = $("#itemId").val();
	
	// Disable interface elements.
	enableInterface(false);
	
	// Fetch given item.
	itemId = itemId.trim();
	progress(1, 1, "Fetching " + provider.name + " product " + itemId + "...");
	provider.fetch(itemId, function(info) {fetchCallback(provider, info);});
}
