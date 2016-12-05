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

var util = {
	rcss: rcss,
	rtype: rtype,
	setup: function(b, c){
		wpConfig = b;
		publicPath = c.replace(/\/$/, '');
	},
	replaceAlias: function(modulePath, file){
		if(/\.\.\//.test(modulePath)){
			var dir = path.resolve(file.replace(/(^.*\/).*$/, '$1'), modulePath);
			return dir.replace(rootDir, '');
		}
		var result = /^(\.?\/)?.+?\//.exec(modulePath)[0].slice(0, -1);
		var tmp = alias[result];
		var dir = tmp ? tmp : "./"+result;
		var reqRoot = path.resolve(rootDir, dir).replace(rootDir, '');
		return modulePath.replace(result, reqRoot);
	},
	getDependencies: function(file, staticPath, isContent){
		var content = isContent ? file : fs.readFileSync(file, 'utf8');
		staticPath = (staticPath || "").replace(/\/$/, '');
		var ret = null;
		var dependencies = [];
		var cdn = (config.cdn || "").replace(/\/$/, '');
		while(ret = rrequire.exec(content)){
			var modulePath = ret[2];
			var finalPath = util.replaceAlias(modulePath, file);
			var replacePath = finalPath;
			if(staticPath){
				replacePath = finalPath.replace(/^\/.+?\//, staticPath+"/");
			}
			var suffix;
			if(rcss.test(replacePath)){
				//css ref goes here.
			}else if(suffix = rtype.exec(replacePath)){
				for(var entry in wpConfig.entry){
					if(finalPath.indexOf(entry) != -1){
						replacePath = publicPath+"/"+entry+"."+suffixMap[suffix[1]];
					}
				}
			}
			dependencies.push({
				raw: ret[0],
				dep: finalPath,
				rep: replacePath,
				cdn: cdn + replacePath
			});
		}
		return dependencies;
	},
	fileTransform: function fileTransform(file, staticPath, isContent){
		var dependencies = util.getDependencies(file, staticPath, isContent);
		var content = isContent ? file : fs.readFileSync(file, 'utf8');
		dependencies.forEach(function(item){
			content = content.replace(item.raw, item.rep);
		});
		return content;
	},
	makeHash: function(path, hash){
		return path.replace(/(^.*\/.*?)(\..*)$/, '$1.'+hash+'$2')
	}
}

module.exports = util;