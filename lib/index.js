import ejs from 'ejs';
import fs from 'fs-extra';
import path from 'path';
import async from 'async';
import showdown from 'showdown';
import sass from 'node-sass';
import chokidar from 'chokidar';
import EventEmitter from 'events';
import {
  debounce
} from 'debounce';

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

const gatherData = (context) => new Promise((resolve, reject) => {
  resolve(context);
});

const runGenerators = (context) => new Promise(async (resolve, reject) => {
  for (let i = 0; i < context.generators.length; i++) {
    context = await context.generators[i].run(context);
  };
  resolve(context);
});

const generatePages = (context) => new Promise(async (resolve, reject) => {
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

    const templateBase = tryReadFileContent(path.join(__dirname, relativeTemplatePath, 'base'));
    const templatePage = tryReadFileContent(path.join(__dirname, relativeTemplatePath, 'page'));
    const markdownConverter = new showdown.Converter({
      noHeaderId: true
    });

    const mappedPages = pages.map(page => {
      if (page.params) {
        Object.keys(page.params).forEach(key => {
          page[key] = page.params[key];
        });
      }

      page.destinationDirectory = path.join(__dirname, path.relative(__dirname, destination), page.base);
      page.absoluteDestinationPath = path.join(page.destinationDirectory, page.name + '.html');
      return page;
    });

    async.each(mappedPages, async (page, done) => {
      try {
        const pageContent = readFileContent(page.path);
        let renderedPage = '';

        switch (page.getFileType()) {
          case 'ejs':
          case 'html':
            const content = templatePage.replace('CONTENT', pageContent);
            const data = {
              page,
              context
            };
            const options = {
              filename: page.path,
              cache: false
            };
            renderedPage = ejs.render(content, data, options);
            break;
          case 'md':
            renderedPage = markdownConverter.makeHtml(pageContent);
            break;
          default:
            console.log(`Could not generate ${from}: file type unknown`);
            done();
            return;
        }

        const renderedFullPage = templateBase.replace('CONTENT', renderedPage);
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

          // console.log('Copy asset', sourceAbsolutePath, absoluteDestinationpath);
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
  context.plugins.forEach(plugin => {
    plugin.register(context);
  });

  const gatherer = context.plugins.map((plugin) => plugin instanceof Gatherer ? plugin : false).filter(plugin => plugin);
  const generators = context.plugins.map((plugin) => plugin instanceof Generator ? plugin : false).filter(plugin => plugin);
  return {
    ...context,
    gatherer,
    generators
  };
};

class Builder extends EventEmitter {
  constructor(config) {
    super();
    this.context = {
      data: {},
      config: {
        baseUrl: '',
        source: 'src',
        destination: 'build',
        permalink: 'blog/{year}/{month}/{day}/{title}',
        templatePath: '_template',
        pluginPath: '_plugins',
        postPath: '_posts',
        assetPath: '_assets',
        scssPath: '_scss',
        ...config
      },
      pages: [],
      posts: [],
      plugins: [
        new StaticPagesPlugin(),
        new PostsPlugin()
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