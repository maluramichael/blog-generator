import path from 'path';
import * as R from 'ramda';
import async from 'async';
import fs from 'fs-extra';
import yaml from 'js-yaml';
import Debug from 'debug';

import {
  getDirectoryContent
} from '../file';
import Generator from '../generator';
import Post from '../post';
import Page from '../page';

module.exports = class Posts extends Generator {
  constructor() {
    super();
  }

  async run(context) {
    const debug = Debug('generator/plugin/Posts');
    const {
      config,
      data
    } = context;
    const {
      source,
      permalink
    } = config;
    let keywords = [];

    return new Promise(async (resolve, reject) => {
      const pattern = `${source}/_posts/**/*.*(ejs|md|html)`;
      const files = await getDirectoryContent(pattern);
      debug(pattern);

      let posts = R.pipe(
        R.map(file => file.replace(`${source}/`, '')),
        R.filter(file => file.match(/\d{4}-\d{1,2}-\d{1,2}/g)), // posts have to begin with 0000-00-00 year-month-day
        R.map((file) => {
          debug(file);
          const filename = path.basename(file);
          const ext = path.extname(filename);
          const name = path.basename(file.replace(ext, ''));

          const [year, month, day] = name.slice(0, 10).split('-');
          let title = name.slice(11);
          let language = '';
          const titleChunks = title.split('.');
          if (titleChunks.length === 1) {
            title = titleChunks[0];
          } else if (titleChunks.length === 2) {
            title = titleChunks[0];
            language = titleChunks[1];
          }

          const replacements = {
            year,
            month,
            day,
            title,
            language
          };

          const replacePermalink = permalink.replace(/\{\w+\}/g, (all) => replacements[all.replace('{', '').replace('}', '')] || all);
          let base = path.dirname(replacePermalink);
          file = path.join(__dirname, path.relative(__dirname, source), file);
          return new Post(title, file, base, {
            language,
            date: {
              year,
              month,
              day
            },
            fullDate: `${day}.${month}.${year}`
          })
        }),
        R.sort((left, right) => {
          const leftDate = new Date(Object.values(left.data.date).join('-'));
          const rightDate = new Date(Object.values(right.data.date).join('-'));
          if (leftDate > rightDate) return -1;
          if (leftDate < rightDate) return 1;
          return 0;
        })
      )(files);

      // Set previous and next page
      for (let i = 0; i < posts.length; i++) {
        const post = posts[i];
        const next = posts[i - 1];
        const previous = posts[i + 1];
        post.next = next;
        post.previous = previous;
      }

      // Read yaml header for each page
      async.each(posts, async (post, done) => {
        try {
          const content = await fs.readFile(post.path, 'utf8');
          const match = content.match(/---(.*)---/smi);
          if (match && match.length === 2) {
            const str = match[1].trim();
            let data = {};
            try {
              data = yaml.load(str);
            } catch (e) {
              debug(post);
              return done('Could not parse header');
            }
            post.params = data;
          }
          done(null);
        } catch (error) {
          done(error);
        }
      }, (error) => {
        if (error) {
          debug(error);
          reject(error);
        } else {
          // const keywords = R.pipe(
          //   R.map(R.path(['params', 'keywords'])),
          //   R.flatten(),
          //   R.uniq()
          // )(posts);
          // const keywordPage = new Page('keywords', file, base, data);
          resolve({
            ...context,
            pages: [...context.pages, ...posts],
            posts
          });
        }
      });

    })
  }
}