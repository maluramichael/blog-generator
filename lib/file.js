import async from 'async';
import fs from 'fs';
import path from 'path';
import glob from 'glob';

// export const getDirectoryContent = (relativePath) => new Promise((resolve, reject) => {
//   fs.readdir(relativePath, (error, files) => {
//     async.map(files, (file, done) => fs.stat(path.join(relativePath, file), (error, stats) => done(error, { path: path.join(file), stats })), (error, files) => {
//       if (error) {
//         reject(error);
//       } else {
//         resolve(files);
//       }
//     })
//   });
// })

export const getDirectoryContent = (pattern) => new Promise((resolve, reject) => {
  glob(pattern, (error, matches) => {
    if (error) {
      reject(error);
    } else {
      resolve(matches);
    }
  })
});


export const getTemplateFiles = (relativePath) => getDirectoryContent(`${relativePath}/**/*.ejs`)
export const getPluginFiles = (relativePath) => getDirectoryContent(`${relativePath}/_plugins/**/*.js`)

export const readFileContent = (relativePath) => new Promise((resolve, reject) => fs.readFile(relativePath, 'utf8', (error, data) => {
  if (error) {
    reject(error);
  } else {
    resolve(data);
  }
}));

export const writeFileContent = (relativePath, content) => new Promise((resolve, reject) => fs.writeFile(relativePath, content, (error) => {
  if (error) {
    reject(error);
  } else {
    resolve();
  }
}));

export const readAndRenderFile = (relativePath, data) => new Promise(async (resolve, reject) => {
  try {
    const content = await readFileContent(relativePath);
    resolve(ejs.render(content, data));
  } catch (e) {
    reject(e);
  }
});

export const createDirectory = (directory) => new Promise((resolve, reject) => {
  fs.mkdir(directory, { recursive: true }, (err) => {
    if (err) { reject(err); } else { resolve(); }
  });
})