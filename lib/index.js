var config = require('config');
var fs = require('fs');
var glob = require('glob');
var dumpUtil = require('res-dump-util');
var path = require('path');
var cssLoader = require('./css-loader');
var resolveImport = cssLoader.resolveImport;
var util = require('./util');
var server = require('../server')
var mime = require('mime');
var chokidar = require('chokidar');
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

var liveReloadResources = (function(){
	var entryCss = [];
	return function(url, file){
		if(!fs.existsSync(file)){
			var idx = entryCss.indexOf(file);
			if(idx != -1){
				entryCss.splice(idx, 1);
			}
			return;
		}
		if(entryCss.indexOf(file)!=-1){
			return;
		}
		entryCss.push(file);
		var watchFiles;
		try{
			watchFiles = getDepsFiles(file);
		}catch(e){
			console.error(e);
		}
		var watcher = chokidar.watch(watchFiles).on('change', onChange);
		function onChange(){
			console.log(file, 'has been changed.');
			cssLoader(file)
				.then(function(css){
					server.publish({
						res: url,
						type: 'css'	 //now only deal with css type file!
					});
				});
			watcher.close();
			try{
				watchFiles = getDepsFiles(file);
			}catch(e){
				console.error(e);
			}
			watcher = chokidar.watch(watchFiles).on('change', onChange);
		}
		function getDepsFiles(file){
			var dep = resolveImport(fs.readFileSync(file, 'utf8'), file).dep;
			var ret = (function(){
				var result = [];
				getDeps(dep);
				function getDeps(cur){
					var dependencies = cur.dependency || [];
					for(var i=0, len=dependencies.length; i<len; i++){
						result.push(dependencies[i]);
						getDeps(cur.get(dependencies[i]))
					}
				}
				return result.filter(function(i, idx){
					return result.indexOf(i) === idx;
				});
			})()
			ret.push(file);
			return ret;
		}
	}
})();

module.exports = function(opts){
	var wpConfig = opts.webpackConfig;
	var makeShortcut = opts.makeShortcut;
	wpConfig.entry[opts.commonFileName] = [opts.commonFileName];
	var publicPath = config.path.publicPath.replace(/\/$/, '');
	util.setup(wpConfig, publicPath);
	var routes = makeShortcut ? makeShortHtmlRequest() : {};

	return function(req, res, next){
		var ret = server.handler(req, res, next);
		if(ret)return;
		if(routes[req.url]){
			return routes[req.url](req, res);
		}
		if(req.url.indexOf(publicPath)!=-1){
			next();
		}else{
			var url = urlStrip(req.url);
			var filePath = dumpUtil.relative(url);
			if(rcss.test(filePath)){
				var fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
				liveReloadResources(fullUrl, filePath);
				return cssLoader(filePath)
				    .then(function (css) {
				    	res.set('Content-Type', 'text/css');
				        res.send(css);
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
						res.set('Content-Type', mime.lookup(filePath));
						res.sendFile(filePath);
					}
				}
			}
		}
	}
}

function makeShortHtmlRequest(){
	var templatePath = config.path.template;
	var routes = {};
	glob
		.sync(templatePath + "/**/*.html")
	    .forEach(function (f) {
	    	var route = f.replace(templatePath, "");
	    	routes[route] = function(r, res){
	    		res.send(fileTransform(f));
	    	};
	    	if(/index\.html$/.test(f)){
	    		routes[route.replace("index.html", "")] = function(r, res){
	    			res.send(fileTransform(f));
	    		};
	    	}
	    });
	return routes;
}

module.exports.fileTransform = fileTransform;
module.exports.transformSetup = util.setup;
module.exports.getDependencies = util.getDependencies;
module.exports.cssLoader = cssLoader;
module.exports.rcss = util.rcss;
