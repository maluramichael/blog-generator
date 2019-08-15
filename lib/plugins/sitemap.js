import path from 'path';
import * as R from 'ramda';
import Debug from 'debug';
const { createSitemap } = require('sitemap')

import {
  getDirectoryContent, writeFileContent, getAbsolutePath
} from '../file';
import Plugin from '../plugin';
import Post from '../post';

module.exports = class SitemapPlugin extends Plugin {
  constructor() {
    super();
  }

  run(context) {
    const debug = Debug('generator/plugin/Sitemap')
    return new Promise(async (resolve, reject) => {
      const {
        config,
        data,
        posts,
        pages
      } = context;
      const {
        source,
        destination
      } = config;

      const urls = R.map((page) => {
        return { url: page.getUrl(destination), changefreq: page instanceof Post ? 'weekly' : 'daily', priority: page instanceof Post ? 0.5 : 0.9 };
      }, pages);
      const sitemap = createSitemap({
        hostname: 'https://malura.de',
        cacheTime: 60 * 60 * 24,
        urls
      });
      const xml = sitemap.toString();

      const destinationDirectory = getAbsolutePath(path.join(destination));
      const absoluteFilePath = path.join(destinationDirectory, 'sitemap.xml');
      await writeFileContent(absoluteFilePath, xml);
      resolve({
        ...context
      });
    })
  }
}