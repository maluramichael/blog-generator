import ejs from 'ejs';
import fs from 'fs-extra';
import path from 'path';
import async from 'async';
import sass from 'node-sass';
import chokidar from 'chokidar';
import EventEmitter from 'events';
import slugify from 'slugify';
import Debug from 'debug';
import matter from 'gray-matter';
import * as R from 'ramda';
import {
  debounce
} from 'debounce';

import markdown from './markdown';

import {
  getDirectoryContent,
  createDirectory,
  tryReadFileContent,
  writeFileContent,
  getAbsolutePath,
  withoutExtension,
  readFileContent
} from './file';

import Gatherer from './gatherer';
import Generator from './generator';
import StaticPagesPlugin from './plugins/staticPages';
import PostsPlugin from './plugins/posts';
import SitemapPlugin from './plugins/sitemap';
import FeedPlugin from './plugins/feed';
import Post from '../lib/post';
import Page from '../lib/page';

const createDestinationDir = (context) => new Promise((resolve, reject) => {
  const {
    config
  } = context;
  const {
    destination
  } = config;
  fs.mkdir(destination, {
    recursive: true
  }, (err) => {
    if (err) {
      reject(err);
    } else {
      resolve(context);
    }
  });
});

const gatherData = (context) => new Promise(async (resolve, reject) => {
  Debug('generator/steps/gatherData')('Start');
  for (let i = 0; i < context.gatherer.length; i++) {
    const gatherer = context.gatherer[i];
    Debug('generator/steps/gatherData')('Run', gatherer);
    context = await gatherer.run(context);
  };
  resolve(context);
});

const runGenerators = (context) => new Promise(async (resolve, reject) => {
  Debug('generator/steps/runGenerators')('Start');
  for (let i = 0; i < context.generators.length; i++) {
    const generator = context.generators[i];
    Debug('generator/steps/runGenerators')('Run', generator);
    context = await generator.run(context);
  };
  resolve(context);
});

const runAllOtherPlugins = (context) => new Promise(async (resolve, reject) => {
  const { generators, gatherer } = context;
  const everythingElse = R.reject(plugin => gatherer.includes(plugin) || generators.includes(plugin), context.plugins);

  Debug('generator/steps/runAllOtherPlugins')('Start');
  for (let i = 0; i < everythingElse.length; i++) {
    const plugin = everythingElse[i];
    Debug('generator/steps/runAllOtherPlugins')('Run', plugin);
    context = await plugin.run(context);
  };
  resolve(context);
});

const generatePages = (context) => new Promise(async (resolve, reject) => {
  const debug = Debug('generator/steps/generatePages');
  debug('Start');
  try {
    const {
      pages,
      config
    } = context;
    const {
      source,
      destination,
      templatePath,
      baseUrl
    } = config;

    const relativeTemplatePath = path.relative(__dirname, path.join(source, templatePath));

    const mappedPages = pages.map(page => {
      if (page.params) {
        Object.keys(page.params).forEach(key => {
          page[key] = page.params[key];
        });
      }

      const newFileName = `${slugify(page.name, {
        remove: /[\/*+~.()'"!:@]/g,
        lower: true
      })}.html`;
      page.destinationDirectory = path.join(__dirname, path.relative(__dirname, destination), page.data.language || '', page.base);
      page.absoluteDestinationPath = path.join(page.destinationDirectory, newFileName);
      page.url = '/' + path.relative(getAbsolutePath(destination), page.absoluteDestinationPath);

      return page;
    });

    const templateBase = await readFileContent(path.join(__dirname, relativeTemplatePath, 'base.ejs'));
    const templatePage = await readFileContent(path.join(__dirname, relativeTemplatePath, 'page.ejs'));
    const templatePost = await readFileContent(path.join(__dirname, relativeTemplatePath, 'post.ejs'));

    async.each(mappedPages, async (page, done) => {
      Debug('generator/steps/generatePages')('Process page', page.name);

      let currentTemplate = '';

      if (page instanceof Post) {
        currentTemplate = templatePost;
      } else {
        currentTemplate = templatePage;
      }

      try {
        let fileContent = await readFileContent(page.path);
        const {
          content,
          data: frontMatter
        } = matter(fileContent);
        let renderedPage = '';

        const data = {
          page: {
            ...page,
            ...page.data,
            ...frontMatter
          },
          site: context
        };
        delete data.page.data
        const ejsOptions = {
          filename: page.path,
          cache: false
        };

        switch (page.getFileType()) {
          case 'ejs':
          case 'html':
            renderedPage = ejs.render(content, data, ejsOptions);
            break;
          case 'md':
            renderedPage = markdown.render(content);
            break;
          default:
            console.log(`Could not generate ${page.name}: file type unknown`);
            done();
            return;
        }

        const fullPageTemplate = templateBase.replace('CONTENT', currentTemplate.replace('CONTENT', renderedPage));
        const renderedFullPage = ejs.render(fullPageTemplate, data, ejsOptions);
        await createDirectory(page.destinationDirectory);
        await writeFileContent(page.absoluteDestinationPath, renderedFullPage);
      } catch (e) {
        console.log(`Could not generate ${page.name}: ${e}`);
      }
      done();
    }, (error) => {
      if (error) {
        reject(e);
      } else {
        resolve(context);
      }
    });
  } catch (e) {
    reject(e);
  }
});

const processAssets = (context) => new Promise(async (resolve, reject) => {
  Debug('generator/steps/processAssets')('Start');
  const {
    config
  } = context;
  const {
    source,
    destination,
    assetPath
  } = config;
  try {
    const files = await getDirectoryContent(`${source}/${assetPath}/**/*.*`);
    async.forEach(files, async (file, done) => {
      const extension = path.extname(file).replace('.', '');
      const base = path.basename(file);
      const sourceAbsolutePath = getAbsolutePath(file);
      const destinationDirectory = getAbsolutePath(path.join(destination, 'assets'));
      const destinationAbsolutePath = path.join(destinationDirectory, base);
      const destinationAbsolutePathWithoutExtension = withoutExtension(destinationAbsolutePath);
      switch (extension) {
        case 'scss':
          sass.render({
            file: sourceAbsolutePath,
            includePaths: [path.join(source, '_scss')],
            outputStyle: 'expanded'
          }, async (err, result) => {
            if (err) {
              console.log(`Could not generate ${sourceAbsolutePath}\n${err}`)
              done();
            } else {
              const css = result.css.toString();
              await fs.outputFile(`${destinationAbsolutePathWithoutExtension}.css`, css);
              done();
            }
          });
          break;
        default: {
          const relativeDestinationPath = path.relative(
            path.join(source, assetPath),
            path.dirname(sourceAbsolutePath)
          );
          const absoluteDestinationDirectoryPath = path.join(destinationDirectory, relativeDestinationPath);
          const absoluteDestinationpath = path.join(absoluteDestinationDirectoryPath, base);
          await createDirectory(absoluteDestinationDirectoryPath);
          try {
            await fs.copyFile(sourceAbsolutePath, absoluteDestinationpath);
          } catch (e) {
            console.error(e);
          }
          done();
          break;
        }
      }
    }, () => {
      resolve(context);
    });
  } catch (e) {
    reject(e);
  }
});

const findPlugins = async (context) => {
  Debug('generator/steps/findPlugins')('Start');
  const {
    config
  } = context;
  const {
    source,
    pluginPath
  } = config;

  const files = await getDirectoryContent(`${source}/${pluginPath}/**/*.js`);

  const plugins = files.map((file) => {
    const pluginPath = path.relative(path.join(__dirname), file);
    const Plugin = require(pluginPath);
    return new Plugin();
  });

  return {
    ...context,
    plugins: [...context.plugins, ...plugins]
  };
};

const loadPlugins = (context) => {
  Debug('generator/steps/loadPlugins')('Start');
  context.plugins.forEach(plugin => {
    plugin.register(context);
  });

  const gatherer = context.plugins.map((plugin) => plugin instanceof Gatherer ? plugin : false).filter(plugin => plugin);
  const generators = context.plugins.map((plugin) => plugin instanceof Generator ? plugin : false).filter(plugin => plugin);
  return {
    ...context,
    gatherer,
    generators,

  };
};

class Builder extends EventEmitter {
  constructor(config) {
    super();
    const now = new Date();
    this.context = {
      lastBuild: now.getDate() + "." + (now.getMonth() + 1) + "." + now.getFullYear(),
      data: {},
      config: {
        baseUrl: '',
        source: 'src',
        destination: 'build',
        permalink: 'blog/{year}/{month}/{day}/{name}',
        templatePath: '_template',
        pluginPath: '_plugins',
        postPath: '_posts',
        assetPath: '_assets',
        scssPath: '_scss',
        cachePath: '_cache',
        dataPath: '_data',
        ...config
      },
      pages: [],
      posts: [],
      plugins: [
        new StaticPagesPlugin(),
        new PostsPlugin(),
        new SitemapPlugin(),
        new FeedPlugin()
      ], // all plugins
      gatherer: [], // get data plugins
      generators: [], // data to pages plugins
    };

    this.initialize();
  }

  context = {}

  async initialize() {
    console.log('Initialize builder');
    try {
      this.context = await createDestinationDir(this.context);
      this.context = await findPlugins(this.context);
      this.context = await loadPlugins(this.context);
      this.context = await gatherData(this.context);
      this.context = await runGenerators(this.context);
      this.context = await runAllOtherPlugins(this.context);
      this.build();
    } catch (e) {
      console.log(e);
    }
  }

  async build(file) {
    console.log('Build...', file);
    try {
      this.context = await generatePages(this.context);
      this.context = await processAssets(this.context);
    } catch (e) {
      console.log(e);
    }
  }

  watch() {
    const {
      config
    } = this.context;
    const {
      source,
      destination
    } = config;

    const runBuild = debounce((file) => this.build(file), 300);

    const sourceWatcher = chokidar.watch(source, {
      ignoreInitial: true
    });
    sourceWatcher.on('all', (event, path) => runBuild(path));

    const buildWatcher = chokidar.watch(destination, {
      ignoreInitial: true
    });
    buildWatcher.on('all', (event, path) => this.emit('change', path));
  }
}

module.exports = Builder;