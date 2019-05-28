import path from 'path';
import * as R from 'ramda';
import async from 'async';
import fs from 'fs';
import yaml from 'js-yaml';

import {
  getDirectoryContent
} from '../file';
import Generator from '../generator';
import Post from '../post';

module.exports = class Posts extends Generator {
  run(context) {
    const {
      config,
      data
    } = context;
    const {
      source,
      permalink
    } = config;

    return new Promise(async (resolve, reject) => {
      const files = await getDirectoryContent(`${source}/_posts/**/*.*(ejs|md|html)`);
      let posts = R.pipe(
        R.map(file => file.replace(`${source}/`, '')),
        R.filter(file => file.match(/\d{4}-\d{1,2}-\d{1,2}/g)), // posts have to begin with 0000-00-00 year-month-day
        R.map((file) => {
          const filename = path.basename(file);
          const ext = path.extname(filename);
          const name = path.basename(file.replace(ext, ''));

          const [year, month, day] = name.slice(0, 10).split('-');
          const title = name.slice(11);
          const replacements = {
            year,
            month,
            day,
            title
          };
          const replacePermalink = permalink.replace(/\{\w+\}/g, (all) => replacements[all.replace('{', '').replace('}', '')] || all);
          let base = path.dirname(replacePermalink);
          file = path.join(__dirname, path.relative(__dirname, source), file);
          return new Post(title, file, base, {
            ...data,
            date: {
              year,
              month,
              day
            }
          })
        }))(files);

      async.each(posts, (post, done) => {
        fs.readFile(post.path, 'utf8', (error, content) => {
          const match = content.match(/---([^---]*)/smi);
          if (match && match.length === 2) {
            const str = match[1].trim();
            let data = {};
            try {
              data = yaml.load(str);
            } catch (e) {
              return done('Could not parse header: ' + e);
            }
            post.params = data;
          }
          done(error);
        });
      }, (error) => {
        resolve({
          ...context,
          pages: [...context.pages, ...posts],
          posts
        });
      });

    })
  }
}