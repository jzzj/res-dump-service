var express = require('express');
var config = require('config');
var fs = require('fs');
var glob = require('glob');
var dumpUtil = require('res-dump-util');
var path = require('path');
var cssLoader = require('./css-loader');
var util = require('./util');
var rcss = util.rcss;
var fileTransform = util.fileTransform;

var staticServerPath = config.path.staticServerPath;
if(!staticServerPath){
	throw new Error("staticServerPath must be indicated through the config/default.js.");
}


function urlStrip(url){
	var ret = url.match(/^(.*\/.*?)(?:$|\?)/);
	if(!ret){
		throw new Error("url is invalid. url:"+url);
	}
	return ret[1];
}

module.exports = function(app, webpackConfig){
	var wpConfig = webpackConfig;
	wpConfig.entry[wpConfig.commonFileName] = [wpConfig.commonFileName];
	var publicPath = config.path.publicPath.replace(/\/$/, '');
	util.setup(wpConfig, publicPath);
	makeShortHtmlRequest(app);
	app.get('*', function(req, res, next){
		if(req.url.indexOf(publicPath)!=-1){
			next();
		}else{
			var url = urlStrip(req.url);
			var filePath = dumpUtil.relative(url);
			if(rcss.test(filePath)){
				cssLoader(filePath)
				    .then(function (result) {
				    	res.set('Content-Type', 'text/css');
				        res.send(result.css);
				    }, function(error){
				    	console.error(error);
				    	res.send(JSON.stringify(error));
				    });
			}else{
				if(!fs.existsSync(filePath)){
					next();
				}else{
					var filePath = dumpUtil.relative(req.url);
					if(/\.(?:html|css|sass|less)/.test(filePath)){
						res.send(fileTransform(filePath));
					}else{
						res.sendFile(filePath);
					}
				}
			}
		}
		
	});

}

module.exports.fileTransform = fileTransform;
module.exports.transformSetup = util.setup;
module.exports.getDependencies = util.getDependencies;
module.exports.cssLoader = cssLoader;
module.exports.rcss = util.rcss;

function makeShortHtmlRequest(app){
	var templatePath = config.path.template;
	glob
		.sync(templatePath + "/**/*.html")
	    .forEach(function (f) {
	    	var route = f.replace(templatePath, "");
	    	app.get(route, function(r, res){
	    		res.send(fileTransform(f));
	    	});
	    	if(/index\.html$/.test(f)){
	    		app.get(route.replace("index.html", ""), function(r, res){
	    			res.send(fileTransform(f));
	    		});
	    	}
	    });
}
