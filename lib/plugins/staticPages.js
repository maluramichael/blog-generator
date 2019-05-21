import path from 'path';
import * as R from 'ramda';

import { getDirectoryContent } from '../file';
import Generator from '../generator';
import Page from '../page';

module.exports = class StaticPages extends Generator {
  run(context) {
    return new Promise(async (resolve, reject) => {
      const { config, data } = context;
      const { source } = config;

      const files = await getDirectoryContent(`${source}/**/*.*(ejs|md|html)`);
      const pages = R.pipe(
        R.map(file => file.replace(`${source}/`, '')),
        R.reject(R.startsWith('_')),
        R.map((file) => {
          const ext = path.extname(file);
          const base = path.dirname(file);
          const name = path.basename(file.replace(ext, ''));
          return new Page(name, file, base)
        })
      )(files);
      resolve({ ...context, pages: [...context.pages, ...pages] });
    })
  }
}