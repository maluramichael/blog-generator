import Gatherer from '../../lib/gatherer';
import fs from 'fs-extra';
import path from 'path';
import async from 'async';
import request from 'request-promise';
import Hash from 'object-hash';
import {
  getAbsolutePath,
  createDirectory
} from '../../lib/file';

module.exports = class GatherMovies extends Gatherer {
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

    const movieCachePath = getAbsolutePath(path.join(source, cachePath, 'movies'));
    await createDirectory(movieCachePath);

    return new Promise(async (resolve, reject) => {
      const jsonString = await fs.readFile(path.join(source, '_data', 'movies.json'));
      const movies = JSON.parse(jsonString);

      async.mapLimit(movies, 3, async (movie, done) => {
        const hash = Hash(movie);
        const movieDirectory = path.join(movieCachePath, hash);
        await createDirectory(movieDirectory);
        const absoluteDataFilePath = path.join(movieDirectory, 'data.json');

        try {
          const exists = await fs.pathExists(absoluteDataFilePath);

          let fetchedData = {};
          if (exists) {
            const cachedString = await fs.readFile(absoluteDataFilePath);
            fetchedData = JSON.parse(cachedString);
          } else {
            console.log('Fetch', movie);

            const qs = {
              api_key: keys.movie_db,
              language: 'de',
              query: movie.title
            };
            if (movie.year) {
              qs.year = movie.year;
            }
            const responseString = await request({
              uri: `https://api.themoviedb.org/3/search/movie`,
              qs
            });

            const response = JSON.parse(responseString);
            const {
              total_results,
              results
            } = response;

            if (total_results > 0) {
              const firstResult = results[0];
              await fs.writeFile(absoluteDataFilePath, JSON.stringify(firstResult, null, 2));
              fetchedData = firstResult;
            }
          }
          done(null, {
            ...movie,
            ...fetchedData
          });
        } catch (e) {
          done(e.message);
        }
      }, (error, resolvedMovies) => {
        if (error) {
          console.log(error);
          reject(error);
        } else {
          console.log(`${resolvedMovies.length} movies resolved`);
          resolve({
            ...context,
            data: {
              ...context.data,
              movies: resolvedMovies
            }
          });
        }
      });
    });
  }
}