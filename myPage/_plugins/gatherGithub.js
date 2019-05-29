import Gatherer from '../../lib/gatherer';
import Github from 'github-api';
import fs from 'fs-extra';
import path from 'path';
import * as R from 'ramda';
import {
  getAbsolutePath,
  createDirectory
} from '../../lib/file';

module.exports = class GatherGithub extends Gatherer {
  async run(context) {
    const {
      pages,
      config
    } = context;
    const {
      source,
      destination,
      templatePath,
      baseUrl,
      cachePath,
      keys
    } = config;

    return new Promise(async (resolve, reject) => {
      const githubCachePath = getAbsolutePath(path.join(source, cachePath, 'github'));
      await createDirectory(githubCachePath);
      const absoluteDataFilePath = path.join(githubCachePath, 'my_repos.json');
      const exists = await fs.pathExists(absoluteDataFilePath);

      let repos = [];
      if (exists) {
        const cachedString = await fs.readFile(absoluteDataFilePath);
        repos = JSON.parse(cachedString);
      } else {
        const github = new Github({
          token: keys.github
        });
        const response = await github.getUser().listRepos({
          type: 'owner'
        });

        repos = R.filter(R.propEq('fork', false), response.data);
        await fs.writeFile(absoluteDataFilePath, JSON.stringify(repos, null, 2));
      }
      resolve({
        ...context,
        data: {
          ...context.data,
          github: {
            repos
          }
        }
      });
    });
  }
}