'use strict';

require('dotenv-safe').load()
const gulp = require('gulp')
const del = require('del')
const imagemin = require('gulp-imagemin')
const browserSync = require('browser-sync').create()
const ftp = require('vinyl-ftp')
const gutil = require( 'gulp-util' )
const runSequence = require('run-sequence')
const critical = require('critical')
const cleanCSS = require('gulp-clean-css')
const htmlmin = require('gulp-htmlmin')
const minify = require('gulp-minify')
const pug = require('gulp-pug')
const _ = require('lodash')
const rename = require('gulp-rename')
const path = require('path')

const allGlob = '/**/*';

// config vars for folders/files:
var source = {  base: './source' };
source.css = source.base + '/assets/css';
source.cssFiles = source.css + '/**/*.css'; // only css files inside source folder
source.img = source.base + '/assets/images';
source.imgAll = source.img + allGlob; // all files in source images folder
source.fonts = source.base + '/assets/fonts';
source.fontsAll = source.fonts + allGlob;
source.htmlFiles = source.base + '/**/*.html'; // only html files inside source folder
source.js = source.base + '/assets/js';
source.jsFiles = source.js + '/**/*.js'; // only js files inside source folder
source.robotsFile = source.base + '/robots.txt'
source.sitemapFile = source.base + '/sitemap.*'
source.pluginsAll = source.base + '/assets/plugins/**/*.*'
source.templates = source.base + '/pages/templates'
source.templatePages = source.base + '/pages/*.pug'
source.templatesAll = source.base + '/pages/**/*.pug'

var build = { base: './build' }
build.css = build.base + '/assets/css'
build.cssFiles = build.css;
build.img = build.base + '/assets/images'
build.imgFiles = [
  build.img + '/*.jpg',
  build.img + '*.png',
  build.img + '*.ico',
  build.img + '*.gif'
];
build.fonts = build.base + '/assets//fonts'
build.js = build.base + '/assets/js'
build.plugins = build.base + '/assets/plugins'
build.catalog = build.base + '/catalog'


// config var for task names:
var task = {
  clean: 'clean',
  processCss: 'process-css',
  processImg: 'process-images',
  processFonts: 'process-fonts',
  processHtml: 'process-html',
  processJs: 'process-js',
  processOther: 'process-other',
  processAll: 'process-build',
  webserver: 'webserver',
  watchJs: 'watch-js',
  watchCss: 'watch-css',
  watchHtml: 'watch-html',
  watchOther: 'watch-other',
  watchPlugins: 'watch-plugins',
  publish: 'publish',
  publishWatch: 'publish-watch',
  reload: 'reload-browser',
  critical: 'critical-css',
  processPlugins: 'process-plugins',
  processTemplatePages: 'process-template-pages',
  watchTemplates: 'watch-templates',
  processCatalog: 'process-catalog'
}

// configuration for publish to FTP:
const connection = {
  user: process.env.FTP_USER,
  password: process.env.FTP_PASSWORD,
  host: process.env.FTP_HOST,
  port: 21,
  sourcePath: [build.base + allGlob],
  destPath: process.env.FTP_PATH,
  maxConnections: process.env.FTP_CONNNECTIONS || 3
}

// helper function for building ftp connection:
function getFtpConnection() {
  return ftp.create({
    host: connection.host,
    port: connection.port,
    user: connection.user,
    password: connection.password,
    parallel: connection.maxConnections,
    log: gutil.log
  });
}

var browserSyncReady = false;

// define generic tasks
gulp.task('default', [ task.webserver] );
gulp.task( task.processAll, function(done) {
  // use undocumented function to start complete build just after clean:
  runSequence( 
    task.clean,
    task.processImg, task.processFonts, task.processCss , task.processHtml, task.processJs,
    task.processPlugins, task.processOther, task.processTemplatePages,
    task.processCatalog,
    task.reload,
    done
  );
});

// browser reload if ready
gulp.task( task.reload, function (done) {
  if( browserSyncReady )
    browserSync.reload();
  done();
});

// Clean: clear all files in build directory
gulp.task( task.clean, function () {
  return del( build.base + allGlob );
});

// CSS: process CSS files
gulp.task( task.processCss, function () {
  return gulp.src( source.cssFiles  )
    .pipe(cleanCSS({debug: true}, function(details) {
      console.log(details.name + ': ' + details.stats.originalSize + 'b (original)');
      console.log(details.name + ': ' + details.stats.minifiedSize + 'b minified');
    }))
    .pipe( gulp.dest( build.css ));
});


// IMG: process image files: minify with imagemin
gulp.task( task.processImg, function () {

  // copy all files from images folder to dest
  return gulp.src( source.imgAll  )
    .pipe(imagemin())
    .pipe( gulp.dest( build.img ));
});

// FONTS: process fonts:
gulp.task( task.processFonts, function () {
  // plain copy of all font files into dest:
  return gulp.src( source.fontsAll  )
    .pipe( gulp.dest( build.fonts ));
});

// HTML: process pages
gulp.task( task.processHtml, function () {
  return gulp.src( source.htmlFiles  )
    .pipe(htmlmin({collapseWhitespace: true}))
    .pipe( gulp.dest( build.base ));
});

// Catalog: Generate catalog
gulp.task( task.processCatalog, function (done) {
  let categories = require( './source/data/categories.json' )

  _.each( categories, ( item ) => {
    gulp.src( source.templates + '/cards.pug' )
      .pipe( pug( {
        basedir: source.templates,
        locals: {
          categories: categories,
          active_category: item,
          active_item: ""
        } } ))
      .pipe( rename( path.format( { name:item.url, ext: '.html' } )))
      .pipe( gulp.dest( build.base + '/catalog/') )
  })

  done()
});


// Templates:
gulp.task( task.processTemplatePages, function () {
  return gulp.src( source.templatePages  )
    .pipe(pug( { basedir: source.templates }))
    .pipe( gulp.dest( build.base ));
});


// JS: process js
gulp.task( task.processJs, function () {
  return gulp.src( source.jsFiles  )
    .pipe( minify( {
      ext: { src:'.js', min: '.js'},
      noSource: true
    }))
    .pipe( gulp.dest( build.js ));
});

// OTHER: process robots.txt & sitemap
gulp.task( task.processOther, function () {
  gulp.src( source.robotsFile  )
    .pipe( gulp.dest( build.base ));

  return gulp.src( source.sitemapFile )
    .pipe( gulp.dest( build.base ));
});

// PLUGINS: process plugins (vendor bundles):
gulp.task( task.processPlugins, function () {
  // plain copy of all font files into dest:
  return gulp.src( source.pluginsAll  )
    .pipe( gulp.dest( build.plugins ));
});

// reload browser and publish site helper function
var reloadAndPublish = function(done) {
  browserSync.reload();
  if (process.env.PUBLISH )
    gulp.run( task.publish );
  done();
};

// WATCH-xxx: Watch for HTML/CSS/JS: process files and then reload dev browser
gulp.task( task.watchHtml, [ task.processHtml ], reloadAndPublish );
gulp.task( task.watchCss, [ task.processCss ], reloadAndPublish );
gulp.task( task.watchJs, [ task.processJs ], reloadAndPublish );
gulp.task( task.watchOther, [ task.processOther ], reloadAndPublish );
gulp.task( task.watchPlugins, [ task.processPlugins ], reloadAndPublish );
gulp.task( task.watchTemplates, [ task.processTemplatePages ], reloadAndPublish );

// Start webserver with live reloading:
gulp.task(task.webserver, [task.processAll], function() {
  // start webserver with live reloading feature:
  browserSync.init({
    server: {
      baseDir: build.base
    }
  });

  browserSyncReady = true;

  // add browserSync.reload to the tasks array to make
  // all browsers reload after tasks are complete.
  gulp.watch( source.jsFiles, [ task.watchJs ] );
  gulp.watch( source.htmlFiles, [ task.watchHtml ] );
  gulp.watch( source.cssFiles, [ task.watchCss ] );
  gulp.watch( source.robotsFile, [ task.watchOther ] );
  gulp.watch( source.sitemapFile, [ task.watchOther ] );
  gulp.watch( source.pluginsAll, [ task.watchPlugins ] );
  gulp.watch( source.templatesAll, [ task.watchTemplates ] );
});

// PUBLISH: upload files to FTP
gulp.task( task.publish, [task.processAll], function() {

  var conn = getFtpConnection();

  var stream = gulp.src( connection.sourcePath, { base: build.base, buffer: false });

  if ( !process.env.PUBLISH_ALL) {
    console.log('publishing only newer files');
    stream = stream.pipe(conn.newer(connection.destPath)); // only upload newer files
  }
  return stream.pipe( conn.dest( connection.destPath ) );
});

gulp.task( task.critical, [ task.processAll], function (done) {
  console.log( 'Start generating critical CSS');
  critical.generate({
    inline: true,
    base: './original/index-old.html',
    src: 'index.html',
    dest: source.base + '/index-old.html',
    minify: true,
    width: 320,
    height: 480
  });
  done();
});
