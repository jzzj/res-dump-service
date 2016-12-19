var fs = require('fs');
var util = require('./util');
var dumpUtil = require('res-dump-util');
var postcss = require('postcss');
var config = require('config');
var path = require('path');
var rcss = util.rcss;
var fileTransform = util.fileTransform;
var getDependencies = util.getDependencies;
var replaceAlias = util.replaceAlias;
var execSync = require('child_process').execSync;
var cssPlugins = [ require('autoprefixer') , require('precss')];
var CircleDependencyDetector = require('circle-dependency-detector');
var detector = CircleDependencyDetector();

if(config.isOnline){
	cssPlugins.push(require('cssnano'));
}

module.exports = function(filePath, staticPath){
	var filePathWithoutSuffix = filePath.replace(/\..*?$/, '');
	var file = dumpUtil.lookup(filePathWithoutSuffix + ".*", rcss);

	if(file){
		detector.reset();
		var content = fs.readFileSync(file, 'utf8');
		try{
			content = resolveImport(content, file).content;
		}catch(e){
			console.error(e);
		}
		if(config.isOnline){
		    // if in online env. copy all needed resource and hash it to dest-folder.
			var deps = getDependencies(content, staticPath, true);
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
			content = fileTransform(content, staticPath, true);
		}
		return Promise.resolve(postcss(cssPlugins)
		    .process(content, {syntax: require('postcss-scss')})
		    .then(function(result){
		    	content = result.css;
				return content;
		    }));
	}
	
	return new Promise(function(resolve, reject){
		reject("Not found any css likely file. Please check suffix of your file: "+filePath);
	});
}

module.exports.resolveImport = resolveImport;


function resolveImport(content, file, parent){
	var rimport = /@import\s+(['"])(.+?)\1;?/g;
	var dep, cur;
	var dependency = detector.init(file);
	var ret = dependency.pushRequireBy(parent);
	if(ret instanceof Error){
		throw new Error('Circle dependency detected! Check your file:'+ file);
	}
	while(dep = rimport.exec(content)){
		if(!dep)throw new Error("@import syntax error! please check your file: "+file);
		cur = dep;
		var rootPath = replaceAlias(dep[2], file);
		dep = dumpUtil.relative(rootPath);
		if(!fs.existsSync(dep)){
			dep = dumpUtil.relative(rootPath, dumpUtil.getFolder(file));
		}
		ret = dependency.pushDependency(dep);
		if(ret instanceof Error){
			throw new Error('Circle dependency detected! Check your file:'+ file);
		}
		if(!fs.existsSync(dep)){
			throw new Error('@import css file:'+cur[2]+' not found! Check your file:'+file);
		}
		content = content.replace(cur[0], resolveImport(fs.readFileSync(dep, 'utf8'), dep, file).content);
	}
	return {
		content: content,
		dep: dependency
	};
}
