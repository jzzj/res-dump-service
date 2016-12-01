var fs = require('fs');
var util = require('./util');
var dumpUtil = require('res-dump-util');
var postcss = require('postcss');
var config = require('config');
var path = require('path');
var rcss = util.rcss;
var fileTransform = util.fileTransform;
var getDependencies = util.getDependencies;
var execSync = require('child_process').execSync;
var cssPlugins = [ require('autoprefixer') , require('precss')];
if(config.isOnline){
	cssPlugins.push(require('cssnano'));
}

module.exports = function(filePath, staticPath){
	var filePathWithoutSuffix = filePath.replace(/\..*?$/, '');
	var result = dumpUtil.lookup(filePathWithoutSuffix + ".*", rcss);

	if(result){
		var content;
		// is in online env. copy all needed resource and hash it to dest-folder.
		if(config.isOnline){
			var deps = getDependencies(result, staticPath);
			content = fs.readFileSync(result, 'utf8');
			deps.forEach(function(item){
				var sourceFile = dumpUtil.relative(item.dep);
				var destFile = dumpUtil.relative(item.rep);
				//create dir
				dumpUtil.mkdirp(destFile.replace(/(^.*\/).*$/, '$1'));
				var hash = dumpUtil.getVersion(sourceFile);
				dumpUtil.copyFile(sourceFile, dumpUtil.makeHash(destFile, hash));
				content = content.replace(item.raw, dumpUtil.makeHash(item.rep, hash));
			});
		}else{
			content = fileTransform(result, staticPath);
		}
		
		return postcss(cssPlugins)
		    .process(content, {parser: require('postcss-scss')});
	}
	
	return new Promise(function(resolve, reject){
		reject("not found any css like file.");
	});
}

