#!/usr/bin/env node

'use strict';
// Load our dependencies

var mkdirp = require('mkdirp');
var argv = require('yargs').argv;
var fs = require('fs');
var path = require('path');
var _ = require('underscore');
var Minimatch = require('minimatch').Minimatch;
var templater = require('spritesheet-templates');
var Spritesmith = require('spritesmith');
var url = require('url2');
var contra = require('contra');
var multi = require('multi-glob');
var spriteConfig = require(path.resolve(argv.config));

function ExtFormat() {
    this.formatObj = {};
}
ExtFormat.prototype = {
    add: function (name, val) {
        this.formatObj[name] = val;
    },
    get: function (filepath) {
        // Grab the extension from the filepath
        var ext = path.extname(filepath);
        var lowerExt = ext.toLowerCase();

        // Look up the file extenion from our format object
        var formatObj = this.formatObj;
        var format = formatObj[lowerExt];
        return format;
    }
};

// Create img and css formats
var imgFormats = new ExtFormat();
var cssFormats = new ExtFormat();

// Add our img formats
imgFormats.add('.png', 'png');
imgFormats.add('.jpg', 'jpeg');
imgFormats.add('.jpeg', 'jpeg');

// Add our css formats
cssFormats.add('.styl', 'stylus');
cssFormats.add('.stylus', 'stylus');
cssFormats.add('.sass', 'sass');
cssFormats.add('.scss', 'scss');
cssFormats.add('.less', 'less');
cssFormats.add('.json', 'json');
cssFormats.add('.css', 'css');

// Define helper for coordinate naming
function getCoordinateName(filepath) {
    // Extract the image name (exlcuding extension)
    var fullname = path.basename(filepath);
    var nameParts = fullname.split('.');

    // If there is are more than 2 parts, pop the last one
    if (nameParts.length >= 2) {
        nameParts.pop();
    }

    // Return our modified filename
    return nameParts.join('.');
}

function loadresizeMap(resizeMap) {
    if (resizeMap) {
        if (resizeMap instanceof String) {
            return JSON.parse(fs.readFileSync(resizeMap, 'utf8'));
        }
        else {
            return resizeMap;
        }
    }
    return null;
}


if (Array.isArray(spriteConfig)) {
    contra.each(spriteConfig, run, noop);
} else {
    run(spriteConfig);
}

function run(params) {

    contra.waterfall([
        function (next) {
            multi.glob(params.src, next);
        },
        function (files, next) {

            // Determine the format of the image
            var imgOpts = params.imgOpts || {};
            var imgFormat = imgOpts.format || imgFormats.get(params.imgDest) || 'png';

            // Set up the defautls for imgOpts
            imgOpts = _.defaults({}, imgOpts, { format: imgFormat });

            var spritesmithParams = {
                src: params.src,
                engine: params.engine,
                algorithm: params.algorithm,
                padding: params.padding || 0,
                algorithmOpts: params.algorithmOpts || {},
                engineOpts: params.engineOpts || {},
                exportOpts: imgOpts
            };

            var spritesmith = new Spritesmith(spritesmithParams);
            // Otherwise, validate our images line up
            spritesmith.createImages(files, function handleImages(err, images) {
                // Process our images now
                var result = spritesmith.processImages(images, spritesmithParams);
                next(null, result);
            });
        }
    ], handle);

    function handle(err, result) {
        if (err) {
            console.log(err);
            throw err;
        }
        persist(result, params);
    }
}

function persist(result, params) {
    createImage(result, params);
    createCSS(result, params);
}

function createCSS(result, params) {
    if (!params.cssDest) { return; }
    var imgName =path.basename(params.imgDest);
    var cssName = path.basename(params.cssDest);
    var resize = loadresizeMap(params.resizeConfig);
    // START OF DUPLICATE CODE FROM grunt-spritesmith
    // Generate a listing of CSS variables
    var coordinates = result.coordinates;
    var properties = result.properties;
    var spritePath = params.imgPath || url.relative(cssName, imgName);
    var spritesheetData = {
        width: properties.width,
        height: properties.height,
        image: spritePath
    };
    var cssVarMap = params.cssVarMap || function noop() { };
    var cleanCoords = [];

    // Clean up the file name of the file
    Object.getOwnPropertyNames(coordinates).sort().forEach(function (file) {

        // Specify the image for the sprite
        var coords = coordinates[file];
        coords.source_image = file;
        // Extract out our name
        coords.name = getCoordinateName(file);
        // DEV: `image`, `total_width`, `total_height` are deprecated as they are overwritten in `spritesheet-templates`
        coords.image = spritePath;
        coords.total_width = properties.width;
        coords.total_height = properties.height;
        // Map the coordinates through cssVarMap
        coords = cssVarMap(coords) || coords;
        var name = coords.name;
        if (resize.hasOwnProperty(name)) {
            var scalingFactor_x = 1;
            var scalingFactor_y = 1;
            if (resize[name] instanceof Array) {
                scalingFactor_x = resize[name][0] / parseInt(coords.width);
                scalingFactor_y = resize[name][1] / parseInt(coords.height);
                var scaledCoords = scaleCoords(coords, scalingFactor_x, scalingFactor_y);
                cleanCoords.push(scaledCoords);
            }
            else {
                for (var prop in resize[name]) {
                    if (resize[name].hasOwnProperty(prop)) {
                        scalingFactor_x = resize[name][prop][0] / parseInt(coords.width);
                        scalingFactor_y = resize[name][prop][1] / parseInt(coords.height);
                        var scaledCoords = scaleCoords(coords, scalingFactor_x, scalingFactor_y, prop);
                        cleanCoords.push(scaledCoords);
                    }
                }
            }
        }
        else {
            // Save the cleaned name and coordinates
            cleanCoords.push(coords);
        }

    });

    function scaleAndRound(value, scale, round) {
        var noOfDecimals = (round || 2);
        var decimalRounder = Math.pow(10, noOfDecimals);
        return Math.round(value * scale * decimalRounder) / decimalRounder;
    }

    function scaleCoords(coords, scalingFactor_x, scalingFactor_y, context) {
        var newCoords = _.extend({}, coords);
        newCoords.name = newCoords.name + (context === "@" || !context ? "" : "-" + context);
        newCoords.x = scaleAndRound(newCoords.x, scalingFactor_x);
        newCoords.y = scaleAndRound(newCoords.y, scalingFactor_y);
        newCoords.width = scaleAndRound(newCoords.width, scalingFactor_x, 0);
        newCoords.height = scaleAndRound(newCoords.height, scalingFactor_y, 0);
        newCoords.background_height = scaleAndRound(newCoords.total_height, scalingFactor_y);
        newCoords.background_width = scaleAndRound(newCoords.total_width, scalingFactor_x);
        newCoords.resize = true;
        return newCoords;
    }

    // If we have handlebars helpers, register them
    var handlebarsHelpers = params.cssHandlebarsHelpers;
    if (handlebarsHelpers) {
        Object.keys(handlebarsHelpers).forEach(function registerHelper(helperKey) {
            templater.registerHandlebarsHelper(helperKey, handlebarsHelpers[helperKey]);
        });
    }

    // If there is a custom template, use it
    var cssFormat = 'spritesmith-custom';
    var cssTemplate = params.cssTemplate;
    if (cssTemplate) {
        if (typeof cssTemplate === 'function') {
            templater.addTemplate(cssFormat, cssTemplate);
        } else {
            templater.addHandlebarsTemplate(cssFormat, fs.readFileSync(cssTemplate, 'utf8'));
        }
        // Otherwise, override the cssFormat and fallback to 'json'
    } else {
        cssFormat = params.cssFormat;
        if (!cssFormat) {
            cssFormat = cssFormats.get(cssName) || 'json';
        }
    }

    // Render the variables via `spritesheet-templates`
    var cssStr = templater({
        sprites: cleanCoords,
        spritesheet: spritesheetData,
        spritesheet_info: {
            name: params.cssSpritesheetName
        }
    }, {
            format: cssFormat,
            formatOpts: params.cssOpts || {}
        });
    // END OF DUPLICATE CODE FROM grunt-spritesmith  
    mkdirp.sync(path.dirname(params.cssDest));
    fs.writeFileSync(params.cssDest, cssStr, 'utf8');
    console.log('"%s" created.', params.cssDest);
}

function createImage(result, params) {
    if (!params.imgDest) { return; }
    mkdirp.sync(path.dirname(params.imgDest));
    var imgFileStream = fs.createWriteStream(params.imgDest,"binary");
    result.image.pipe(imgFileStream);

    console.log('"%s" created.', params.imgDest);

}

