import path from 'path';
import slugify from 'slugify';
import {
  getAbsolutePath,
} from './file';

module.exports = class Page {
  constructor(name, absolutePath, base = '.', data = {}) {
    this.name = name;
    this.path = absolutePath;
    this.base = base;
    this.data = data;

    this.filename = path.basename(absolutePath);
  }

  getFileType() {
    return path.extname(this.path).replace('.', '');
  }

  getUrl(destination) {
    const newFileName = `${slugify(this.name)}.html`.toLowerCase();
    const destinationDirectory = path.join(__dirname, path.relative(__dirname, destination), this.data.language || '', this.base);
    const absoluteDestinationPath = path.join(destinationDirectory, newFileName);
    return '/' + path.relative(getAbsolutePath(destination), absoluteDestinationPath);
  }
}