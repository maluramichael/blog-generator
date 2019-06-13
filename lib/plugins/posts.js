import path from 'path';
import * as R from 'ramda';
import async from 'async';
import fs from 'fs-extra';
import yaml from 'js-yaml';
import Debug from 'debug';
import matter from 'gray-matter';
import slugify from 'slugify';

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
      destination,
      permalink
    } = config;

    return new Promise(async (resolve, reject) => {
      const pattern = `${source}/_posts/**/*.*(ejs|md|html)`;
      const files = await getDirectoryContent(pattern);
      debug(pattern);

      const readFiles = (files, done) => {
        async.map(files, async (file, done) => {
          const absolutePath = path.join(__dirname, path.relative(__dirname, source), file);
          let fileContent = await fs.readFile(absolutePath, 'utf8');
          const {
            content,
            data
          } = matter(fileContent);
          done(null, {
            content,
            frontMatter: data,
            file
          })
        }, (error, files) => done(error, files));
      }

      const createPosts = (files, done) => {
        const posts = R.pipe(
          R.map((post) => ({
            ...post,
            file: post.file.replace(`${source}/`, '')
          })),
          R.filter(({
            file
          }) => file.match(/\d{4}-\d{1,2}-\d{1,2}/g)), // posts have to begin with 0000-00-00 year-month-day
          R.map(({
            file,
            frontMatter
          }) => {
            debug(file);
            const filename = path.basename(file);
            const ext = path.extname(filename);
            const filenameWithoutExtension = path.basename(file.replace(ext, ''));

            const [year, month, day] = filenameWithoutExtension.slice(0, 10).split('-');
            let name = frontMatter.name || filenameWithoutExtension.slice(11);
            const titleChunks = name.split('.');
            if (titleChunks.length === 1) {
              name = titleChunks[0];
            }

            const replacements = {
              year,
              month,
              day,
              name: slugify(name).toLowerCase(),
            };

            const replacePermalink = permalink.replace(/\{\w+\}/g, (all) => replacements[all.replace('{', '').replace('}', '')] || all);
            let base = path.dirname(replacePermalink);
            file = path.join(__dirname, path.relative(__dirname, source), file);

            return new Post(name, file, base, {
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

        done(null, posts);
      };

      const setNextAndPreviousPosts = (posts, done) => {
        for (let i = 0; i < posts.length; i++) {
          const post = posts[i];
          const next = posts[i - 1];
          const previous = posts[i + 1];
          post.next = next;
          post.previous = previous;
        }
        done(null, posts);
      };

      const gatherKeywords = (posts, done) => {
        const keywords = R.pipe(
          R.map(R.path(['data', 'keywords'])),
          R.flatten(),
          R.uniq(),
          R.reject(R.isNil())
        )(posts);

        done(null, {
          posts,
          keywords
        })
      };

      async.waterfall([
        async.apply(readFiles, files),
          createPosts,
          setNextAndPreviousPosts,
          gatherKeywords
      ], (error, {
        posts,
        keywords
      }) => {
        console.log(`${posts.length} posts`);
        resolve({
          ...context,
          pages: [...context.pages, ...posts],
          posts,
          keywords
        });
      });

    })
  }
}