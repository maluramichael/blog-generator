import path from 'path';
import Debug from 'debug';
import { Feed } from "feed";
import matter from 'gray-matter';

import {
  writeFileContent,
  getAbsolutePath,
  readFileContent
} from '../file';
import Plugin from '../plugin';
import markdown from '../markdown';

module.exports = class FeedPlugin extends Plugin {
  constructor() {
    super();
  }

  run(context) {
    const debug = Debug('generator/plugin/Feed')
    return new Promise(async (resolve, reject) => {
      const {
        config,
        posts,
      } = context;
      const {
        destination,
        author,
        description,
        language,
        url,
        email
      } = config;

      const feed = new Feed({
        title: author,
        description: description,
        id: url,
        link: url,
        language,
        image: `${url}/assets/images/portrait_colored_200.png`,
        favicon: `${url}/assets/favicon.ico`,
        // copyright: "All rights reserved 2013, John Doe",
        // generator: "blog-generator", // optional, default = 'Feed for Node.js'
        feedLinks: {
          json: `${url}/feed.json`,
          atom: `${url}/atom.xml`,
          rss: `${url}/feed.xml`,
        },
        author: {
          name: author,
          email: email,
          link: url
        }
      });

      for (let i = 0; i < posts.length; i++) {
        const post = posts[i];
        let fileContent = await readFileContent(post.path);
        const { content } = matter(fileContent);
        let renderedPage = markdown.render(content);
        renderedPage = renderedPage.replace(/src="\//g, `src="${url}/`);
        renderedPage = renderedPage.replace(/href="\//g, `href="${url}/`);

        feed.addItem({
          title: post.name,
          id: url + post.getUrl(destination),
          link: url + post.getUrl(destination),
          // description: post.description,
          content: renderedPage,
          language: post.language || language || 'de',
          author: [{
            name: "Michael Malura",
            email: "michael@malura.de",
            link: "https://malura.de"
          }],
          date: post.getDate(),
          image: post.image
        });
      }

      feed.addCategory("Technologie");

      const destinationDirectory = getAbsolutePath(path.join(destination));
      await writeFileContent(path.join(destinationDirectory, 'feed.xml'), feed.rss2());
      await writeFileContent(path.join(destinationDirectory, 'atom.xml'), feed.atom1());
      await writeFileContent(path.join(destinationDirectory, 'feed.json'), feed.json1());

      resolve({
        ...context
      });
    })
  }
}