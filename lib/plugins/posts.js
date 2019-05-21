import path from 'path';
import * as R from 'ramda';

import { getDirectoryContent } from '../file';
import Generator from '../generator';
import Post from '../post';

module.exports = class Posts extends Generator {
  run(context) {
    return new Promise(async (resolve, reject) => {
      const { config, data } = context;
      const { source, permalink } = config;

      const files = await getDirectoryContent(`${source}/_posts/**/*.*(ejs|md|html)`);
      const posts = R.pipe(
        R.map(file => file.replace(`${source}/`, '')),
        R.filter(file => file.match(/\d{4}-\d{1,2}-\d{1,2}/g)), // posts have to begin with 0000-00-00 year-month-day
        R.map((file) => {
          const ext = path.extname(file);
          const name = path.basename(file.replace(ext, ''));

          const [year, month, day] = name.slice(0, 10).split('-');
          const title = name.slice(11);
          const replacements = { year, month, day, title };
          const replacePermalink = permalink.replace(/\{\w+\}/g, (all) => replacements[all.replace('{', '').replace('}', '')] || all);
          const base = path.dirname(replacePermalink);

          return new Post(title, file, base, data)
        })
      )(files);
      resolve({ ...context, pages: [...context.pages, ...posts] });
    })
  }
}