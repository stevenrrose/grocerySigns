/**
 * Umbrella module for client-side template files.
 */

// Modules for JS file loading.
var vm = require('vm');
var fs = require('fs');

/**
 * include
 * 
 * Execute the given JS file in the current context.
 * 
 * @param {string} path file to include
 */
function include(path) {
    var code = fs.readFileSync(path, 'utf-8');
    vm.runInThisContext(code, path);
}

//TODO
global.fontLoaded = function() {}
global.imageLoaded = function() {}

global.FontFile = function(url, onload) {
}
global.ImageFile = function(url, onload) {
}


include('../templates/templates.js');

// Export the above *global.templates* variable defined in above file.
exports.templates = global.templates;
