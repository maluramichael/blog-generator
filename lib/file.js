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

export const getAbsolutePath = (relative) => path.join(__dirname, path.relative(__dirname, relative));
export const withoutExtension = (file) => file.replace(path.extname(file), '');

export const getDirectoryContent = (pattern) => new Promise((resolve, reject) => {
  glob(pattern, (error, matches) => {
    if (error) {
      reject(error);
    } else {
      resolve(matches);
    }
  })
});

export const tryReadFileContent = (relativePathWithoutExtension, extensions = ['ejs', 'md', 'html']) => {
  for (let index = 0; index < extensions.length; index++) {
    const extension = extensions[index];
    const filePath = `${relativePathWithoutExtension}.${extension}`;
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf8');
    }
  }
}

export const readFileContent = (absolutePath) => {
  return new Promise((resolve, reject) => {
    fs.exists(absolutePath, (exists) => {
      if (exists) {
        fs.readFile(absolutePath, 'utf8', (error, data) => {
          if (error) {
            reject(error);
          } else {
            resolve(data);
          }
        });
      } else {
        resolve('');
      }
    });
  });
}

export const writeFileContent = (absolutePath, content) => new Promise((resolve, reject) => fs.writeFile(absolutePath, content, (error) => {
  console.log('Write file', absolutePath);
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
  fs.exists(directory, (exists) => {
    if (exists) {
      resolve();
    } else {
      console.log('Create directory', directory);
      fs.mkdir(directory, {
        recursive: true
      }, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    }
  })
});