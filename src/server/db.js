/**
 * DB-related stuff. The DB storage engine is MongoDB, and we use the 
 * Mongoose ODM.
 */

var mongoose = require('mongoose');
mongoose.connect('mongodb://localhost/grocery-signs');

var Schema = mongoose.Schema;

/**
 * Image
 * 
 * Mongoose model for downloaded image data.
 * 
 * @property url URL of image (unique key)
 * @property type MIME type of image
 * @property data Binary image data
 * 
 * @see /scraper/fetchImage?url={url}
 */
var imageSchema = new Schema({
    url: { type: String, index: { unique: true }},
    type: String,
    data: Buffer
});
var Image = mongoose.model('Image', imageSchema);

/**
 * ScraperResult
 * 
 * Mongoose model for scraper results.
 * 
 * @property provider data provider ID (e.g. 'OkCupid')
 * @property id provider-local page ID (e.g. 'hotgirl90')
 * @property seed default seed
 * @property sentences array of strings from scraped page
 * @property images array of image URLs from scraped page
 * @property bookmarks array of saved permutation seeds
 * 
 * @see /scraper/bookmark
 */
var scraperResultSchema = new Schema({
    provider: String,
    id: String,
    seed: Number,
    sentences: [String],
    images: [String],
    bookmarks: [Number]
});
scraperResultSchema.index({provider: 1, id: 1}, { unique: true});
scraperResultSchema.index({seed: 1});
var ScraperResult = mongoose.model('ScraperResult', scraperResultSchema);

/**
 * Bookmark
 * 
 * Mongoose model for bookmarks.
 * 
 * @property date date of save op
 * @property caller client application ID
 * @property provider data provider ID (e.g. 'OkCupid')
 * @property id provider-local page ID (e.g. 'hotgirl90')
 * @property seed saved permutation seed (optional)
 */
var bookmarkSchema = new Schema({
    date: { type: Date, default: Date.now},
    caller: String,
    provider: String,
    id: String,
    seed: Number
});
bookmarkSchema.index({date: 1});
var Bookmark = mongoose.model('Bookmark', bookmarkSchema);

/**
 * Exports.
 */
exports.Image = Image;
exports.ScraperResult = ScraperResult;
exports.Bookmark = Bookmark;
