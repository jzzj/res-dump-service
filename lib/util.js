var rcss = /\.(css|scss|sass|less)(?:$|\?)/;
var rtype = /\.(js|css|es6|scss|sass|vue|jsx|less)(?:$|\?)/;
var rrequire = /\$\{require\((['"])([^)]*)\1\)\}/g;
var fs = require('fs');
var path = require('path');
var rootDir = process.cwd();
var config = require('config');

var suffixMap = {
	"jsx": "js",
	"es6": "js",
	"js": "js",
	"vue": "js",
	"scss": "css",
	"sass": "css",
	"less": "css",
	"css": "css"
};
var alias = config.alias;
var wpConfig;
var publicPath = "/";

function getDependencies(file, staticPath){
	var content = fs.readFileSync(file, 'utf8');
	staticPath = (staticPath || "").replace(/\/$/, '');
	var ret = null;
	var dependencies = [];
	while(ret = rrequire.exec(content)){
		var modulePath = ret[2];
		var result = /^(\.?\/)?.+?\//.exec(modulePath)[0].slice(0, -1);
		var tmp = alias[result];
		var dir = tmp ? tmp : "./"+result;
		var reqRoot = path.resolve(rootDir, dir).replace(rootDir, '');
		var finalPath = modulePath.replace(result, reqRoot);
		var replacePath = finalPath;
		if(staticPath){
			replacePath = finalPath.replace(/^\/.+?\//, staticPath+"/");
		}
		var suffix;
		if(rcss.test(finalPath)){
			//css ref goes here.
		}else if(suffix = rtype.exec(finalPath)){
			for(var entry in wpConfig.entry){
				if(finalPath.indexOf(entry) != -1){
					replacePath = (/(^http|^\/\/)/.test(staticPath) ? staticPath : publicPath)+"/"+entry+"."+suffixMap[suffix[1]];
				}
			}
		}
		dependencies.push({
			raw: ret[0],
			dep: finalPath,
			rep: replacePath
		});
	}
	return dependencies;
}

module.exports = {
	rcss: rcss,
	rtype: rtype,
	setup: function(b, c){
		wpConfig = b;
		publicPath = c;
	},
	getDependencies: getDependencies,
	fileTransform: function fileTransform(file, staticPath){
		var dependencies = getDependencies(file, staticPath);
		var content = fs.readFileSync(file, 'utf8');
		dependencies.forEach(function(item){
			content = content.replace(item.raw, item.rep);
		});
		return content;
	},
	makeHash: function(path, hash){
		return path.replace(/(^.*\/.*?)(\..*)$/, '$1.'+hash+'$2')
	}
}