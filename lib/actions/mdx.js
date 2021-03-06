/* read input from <input> and generate fenced code blocks at
<output>/mdx
*/
var fs = require('fs-extra');
var exec = require('child_process').exec;
var path = require('path');
var async = require('async');
var through2 = require('through2')
var rimraf = require('rimraf');
var klaw = require('klaw');
var ncp = require('ncp').ncp;
ncp.limit = 16;

module.exports = function (options, done) {
  var config = options.config;
  var formats = options.formats;
  var outputpath = config.output;
  var inputFolder = path.join(__cwd, config.input);

  var readMdFiles = function (done) {
    var files = []
    var folderRegex = new RegExp(config.input + '.*');
    var excludeDirFilter = through2.obj(function (item, enc, next) {
      var fileSplit = item.path.split('/');
      var filename = fileSplit.pop();
      if (!item.stats.isDirectory() && !/^\./.test(filename) && filename.search('-content') === -1) {
        this.push({ path: item.path, name: filename, folder: fileSplit.join('/').match(folderRegex)[0] });
      }
      next();
    });
    klaw(inputFolder).pipe(excludeDirFilter).on('data', function (item) { files.push(item); })
        .on('end', function () { done(files); });
  };

  rimraf(path.join(__cwd, config.output, 'mdx'), function (rerr) {
    readMdFiles(function (files) {
      var doWork = function(index) {
          if ( index === files.length ) {
            done();
          } else {
            var file = files[index];
            var filePaths = file.path.replace(inputFolder, config.output + '/mdx').split('/');
            var filename = filePaths[filePaths.length - 1];
            var outputPathDirs = filePaths.slice(0, filePaths.length - 1).join('/');
            var filePathToWrite = path.join(outputPathDirs, filename);
            if (rerr) { return console.log(rerr);}
            fs.readFile(file.path, 'utf-8', function (err, data) {
              if (err) {return console.log(err);}
              var re = new RegExp('```' + '[\\w]+', 'g');
              var mat = data.match(re);
              if (mat) {
                mat.forEach(function (key) {
                  var lan = key.replace('```', '');
                  if (lan === 'typescript') {
                    lan = 'java';
                  }
                  if (lan === 'css') {
                    lan = 'css'
                  }
                  data = data.replace(key, '~~~~{.numberLines .' + lan + ' startFrom="1"}')
                });
                data = data.replace(/```/g, '~~~~~~~');
              }
              fs.ensureDir(outputPathDirs, function (enErr) {
                if (enErr) { return console.log(enErr);}
                fs.writeFile(filePathToWrite, data, function (writeErr) {
                  if (writeErr) { return console.log(writeErr); }
                  doWork(index + 1);
                });
              });
            });
          }
      };
      doWork(0);
    });

  });
};
