const ejs = require('ejs');
const fs = require('fs');
const path = require('path');
import async from 'async';
import showdown from 'showdown';

import { getDirectoryContent, createDirectory, readFileContent, writeFileContent } from './file';

import Gatherer from './gatherer';
import Generator from './generator';
import StaticPagesPlugin from './plugins/staticPages';
import PostsPlugin from './plugins/posts';

const createDestinationDir = (context) => new Promise((resolve, reject) => {
  const { config } = context;
  const { destination } = config;
  fs.mkdir(destination, { recursive: true }, (err) => {
    if (err) { reject(err); } else { resolve(context); }
  });
});

const gatherData = (context) => new Promise((resolve, reject) => {
  // const fuu = context.gatherer.map(gatherer => gatherer);
  // console.log(fuu);
  // // Promise.all().then(() => {
  // //   resolve(context);
  // // });
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
    const { pages, config, data } = context;
    const { source, destination, templatePath } = config;
    const templateBase = await readFileContent(path.join(source, templatePath, 'base.ejs'));
    const templatePage = await readFileContent(path.join(source, templatePath, 'page.ejs'));
    const markdownConverter = new showdown.Converter({ noHeaderId: true });

    async.each(pages, async (page, done) => {
      try {
        const destinationDir = path.join(destination, page.base);
        await createDirectory(destinationDir);
        const from = path.join(source, page.path);
        const to = path.join(destinationDir, page.name + '.html');
        console.log(`Generate ${to}`);

        const pageContent = await readFileContent(from);
        let renderedPage = '';

        switch (page.getFileType()) {
          case 'ejs':
          case 'html':
            renderedPage = ejs.render(templatePage.replace('CONTENT', pageContent), { page, context }, { filename: from });
            break;
          case 'md':
            renderedPage = markdownConverter.makeHtml(pageContent);
            break;
        }
        const renderedFullPage = templateBase.replace('CONTENT', renderedPage);
        await writeFileContent(to, renderedFullPage);
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
  try {
    resolve(context);
  } catch (e) {
    reject(e);
  }
});

const findPlugins = async (context) => {
  const { config } = context;
  const { source, pluginPath } = config;

  const files = await getDirectoryContent(`${source}/${pluginPath}/**/*.js`);

  const plugins = files.map((file) => {
    const pluginPath = path.relative(path.join(__dirname), file);
    const Plugin = require(pluginPath);
    return new Plugin();
  });

  return { ...context, plugins: [...context.plugins, ...plugins] };
};

const loadPlugins = (context) => {
  context.plugins.forEach(plugin => {
    plugin.register(context);
  });

  const gatherer = context.plugins.map((plugin) => plugin instanceof Gatherer ? plugin : false).filter(plugin => plugin);
  const generators = context.plugins.map((plugin) => plugin instanceof Generator ? plugin : false).filter(plugin => plugin);
  return { ...context, gatherer, generators };
};

const build = async (config) => {
  let context = {
    data: { test: 1 },
    config: {
      source: 'src',
      destination: 'build',
      permalink: 'blog/{year}/{month}/{day}/{title}',
      templatePath: '_template',
      pluginPath: '_plugins',
      postPath: '_posts',
      assetPath: '_assets',
      ...config
    },
    pages: [],
    plugins: [
      new StaticPagesPlugin(),
      new PostsPlugin()
    ], // all plugins
    gatherer: [], // get data plugins
    generators: [], // data to pages plugins
  };

  try {
    context = await createDestinationDir(context);
    context = await findPlugins(context);
    context = await loadPlugins(context);
    context = await gatherData(context);
    context = await runGenerators(context);
    context = await generatePages(context);
    context = await processAssets(context);
  } catch (e) {
    console.log(e);
  }
};

module.exports = { build };