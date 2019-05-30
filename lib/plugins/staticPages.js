import path from 'path';
import * as R from 'ramda';
import Debug from 'debug';

import {
  getDirectoryContent
} from '../file';
import Generator from '../generator';
import Page from '../page';

module.exports = class StaticPages extends Generator {
  constructor() {
    super();
  }

  run(context) {
    const debug = Debug('generator/plugin/StaticPages')
    return new Promise(async (resolve, reject) => {
      const {
        config,
        data
      } = context;
      const {
        source
      } = config;

      const pattern = `${source}/**/*.*(ejs|md|html)`;
      const files = await getDirectoryContent(pattern);
      debug(pattern);
      const pages = R.pipe(
        R.map(file => file.replace(`${source}/`, '')),
        R.reject(R.anyPass([
          R.startsWith('_'),
          R.startsWith('node_modules')
        ])),
        R.map((file) => {
          debug(file);
          const filename = path.basename(file);
          const ext = path.extname(filename);
          const base = path.dirname(file);
          const name = path.basename(file.replace(ext, ''));
          file = path.join(__dirname, path.relative(__dirname, source), file);
          return new Page(name, file, base, data);
        }))(files);

      resolve({
        ...context,
        pages: [...context.pages, ...pages]
      });
    })
  }
}