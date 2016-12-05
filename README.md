# res-dump-service
Make html file be the entry again. Server every ${require('...')} placed in html/css file.

## What this for?
This service(actually, should called server) start a server on development env when you use [boilerplate](https://github.com/jzzj/boilerplate)  
It will serve your assets are not import by js, however, usage just like you did.  

## Usage
```js
var resDumpService = require('res-dump-service');
//init some routes.
resDumpService(app, {
    webpackConfig: webpackConfig,
    commonFileName: "common"
});
```
It will scan all .html files that resided in config.path.template folder. And make shortcut to access html files.  
In html files, you can use ```${require('@alias/path/to/your/source/file')}``` to require any assets you want, just like the js require method!  

## How does it work?
Actually, it recieve a html request, it treat html file as a template, find ```require()```, then replace it with actual file path.  
If it recieve a resource request, it will try to find it in source folder, if found it, then preprocess file and return. But, if it did not find it, then pass the proxy to next handler(here, is a devserver-middleware), this is for the js files.
