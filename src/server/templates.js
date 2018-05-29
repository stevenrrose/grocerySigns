/**
 * Umbrella module for client-side template and PDF generation files.
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

// Include the template definition file.
global.FontFile = require("../common/FontFile.js");
global.ImageFile = require("../common/ImageFile.js");
global.fontLoaded = function() {}
global.imageLoaded = function() {}
global.pdfMode = true;
include('../templates/templates.js');

// Export the above *global.templates* variable defined in above file.
exports.templates = global.templates;

// Merge & export all template field names.
var fieldNames = {};
for (var key in global.templates) {
    var template = global.templates[key];
    for (var id in template.fields) {
        var field = template.fields[id];
        if (field.type == 'image' || field.type == 'static') continue;
        if (field.inputId) id = field.inputId;
        fieldNames[id] = 1;
    }
}
exports.fields = Object.keys(fieldNames);

// Include and export the PDF generation functions.
global.PDFDocument = require('pdfkit');
include('../templates/generate.js');
exports.generateRandomSeed = global.generateRandomSeed;
exports.generatePDF = global.generatePDF;
exports.computeActualMaxFieldLengths = global.computeActualMaxFieldLengths;
