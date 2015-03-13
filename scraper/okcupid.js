/*
 *
 * OkCupid scraping functions.
 *
 * Depends on variable *fetchUrl* containing the URL of the fetch proxy.
 *
 */

providers["OkCupid"] = {
	name: "OkCupid",
	
	/** Length of random string used to search for profiles. */
	randomSearchStringLength: 2,
	
	/**
	 * Search OkCupid products. Return item ID = profile IDs for first result page.
	 *
	 *	@param what			Search string.
	 *	@param callback		Function called with results.
	 */
	search: function(what, callback) {
		console.log("search", what);
		var url = "http://www.google.com/search?q=site:www.okcupid.com/profile+" + what;
		console.log(url);
		artoo.ajaxSpider(
			[{url: fetchUrl, data: {url: url}}],
			{
				scrape: {
					iterator: "#ires div.s div.kv cite",
					data: {
						itemId: function() {
							var re = /\/profile\/([^/?]+)/.exec($(this).text());
							if (!re) return undefined;
							return re[1];
						},
					}
				}
			},
			function(data) {
				callback(data[0]);
			}
		);
	},

	/**
	 * Fetch & scrape given OkCupid profile.
	 *
	 *	@param itemId		Item ID of the product to scrape.
	 *	@param callback		Function called with product info.
	 */ 
	fetch: function(itemId, callback) {
		console.log("fetch", itemId);
		var url = "http://www.okcupid.com/profile/" + itemId;
		artoo.ajaxSpider(
			[{url: fetchUrl, data: {url: url}}],
			{
				scrape: {
					params: {limit: 1},
					iterator: "#main_content",
					data: {
						title: {sel: "#basic_info_sn"},
						price: {sel: "#ajax_age"},
						vendor: {sel: "#ajax_location"},
						features: {sel: "#profile_details", scrape: {iterator: "dl", data: function() {
							var val = $(this).find("dd").contents(":not(script)").text().trim();
							if (val == "") val = $(this).find("dd").text();
							if (!val.match(/\w/)) return undefined;
							return $(this).find("dt").text().trim() + ": " + val;
						}}},
						description: function() {
							return splitSentences(
								$.makeArray(
									$(this).find("#main_column .text").contents()
										.map(function() {
											return $(this).text();
										})
								).join(". ")
							).filter(function(e) {
								return e.trim() != "";
							});
						},
						image: {sel: "#thumb0 img", attr: 'src'},
					}
				}
			},
			function(data) {
				var info = data[0][0];
				callback($.extend({success: info ? true : false, itemId: itemId, url: url}, info));
			}
		);
	},
};
