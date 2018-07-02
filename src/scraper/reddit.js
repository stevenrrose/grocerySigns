/*
 *
 * Reddit scraping functions.
 *
 * Depends on variable *fetchUrl* containing the URL of the fetch proxy.
 *
 */

providers["Reddit"] = {
    name: "Reddit",
    
    /** Allowed URL pattern. */
    urlPattern: /^https:\/\/www\.reddit\.com\/.+$/,

    /** We don't need random strings as Reddit already provides us with randomized pages. */
    randomSearchStringLength: 0,
    
    /**
     * Search Reddit subs.
     *
     *  @param what         Search string. Unused.
     *  @param callback     Function called with results.
     */
    search: function(what, callback) {
        // Reddit kindly provides us with random pages.
        // TODO: subreddit whitelist?
        callback([{itemId: "random"}]);
    },

    /**
     * Fetch & scrape given Reddit page.
     *
     *  @param itemId       Item ID of the page to scrape.
     *  @param callback     Function called with page info.
     */ 
    fetch: function(itemId, callback) {
        console.log("fetch", itemId);
        var url = "https://www.reddit.com/" + itemId;
        console.log(url);
        artoo.ajaxSpider(
            [{url: fetchUrl, data: {url: url}}],
            function(data) {
                try {
                    var info = {};
                    var m = data[0].match(/window.___r = ({.*?});/);
                    var d = JSON.parse(m[1]);
                    var postId = d.shortcuts.activePostId;
                    var post = d.posts.models[postId];
                    info.url = post.permalink;
                    // Generate item ID from URL path with /'s replaced by |'s.
                    info.itemId = new URL(info.url).pathname.replace(/\//g, '|');
                    info.title = post.title;
                    info.price = post.score.toString();
                    info.vendor = post.author;
                    if (post.thumbnail) {
                        info.images = [post.thumbnail.url];
                    }
                    info.description = [];
                    for (var commentId in d.comments.models) {
                        try {
                            var sentences = splitSentences(d.comments.models[commentId].bodyMD)
                                .filter(function(e) {
                                    return e.trim() != "";
                                });
                            info.description.push.apply(info.description, sentences)
                        } catch (e) {}
                    }
                    callback($.extend({success: true}, info));
                } catch (error) {
                    callback({success: false, error: error});
                }
            }
        );
        /*
        artoo.ajaxSpider(
            [{url: fetchUrl, data: {url: url}}],
            {
                scrape: {
                    iterator: "#2x-container",
                    data: {
                        url: function() {
                            return $(this).find("link[rel='canonical']").attr('href');
                        },
                        title: function() {
                            return $(this).find("title").text();
                        },
                        price: function() {
                            return $(this).parent().find(".score .number").text();
                        },
                        vendor: {sel: ".title ~ .tagline .author", method: 'text'},
                        description: function() {
                            return splitSentences(
                                $.makeArray(
                                    $(this).parent().find(".usertext").contents()
                                        .map(function() {
                                            return $(this).text();
                                        })
                                ).join(". ")
                            ).filter(function(e) {
                                return e.trim() != "";
                            });
                        },
                        images: {scrape: {iterator: "img", data: 'src'}},
                    }
                }
            },
            function(data) {
                try {
                    var info = data[0][0];
                    // Generate item ID from URL path with /'s replaced by |'s.
                    info.itemId = new URL(info.url).pathname.replace(/\//g, '|');
                    // Fix URL protocol in images.
                    if (info.images) {
                        for (var i = 0; i < info.images.length; i++) {
                            if (info.images[i].match(/^\/\//)) {
                                info.images[i] = "https:" + info.images[i];
                            }
                        }
                    }
                    callback($.extend({success: info ? true : false}, info));
                } catch (error) {
                    callback({success: false, error: error});
                }
            }
        );
        */
    },
};
