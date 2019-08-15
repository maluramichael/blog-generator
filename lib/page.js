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

  getDate() {
    const { data } = this;
    const { date } = data;
    const { year, month, day } = date;
    return new Date(year, month, day, 13, 0, 0, 0)
  }

  getUrl(destination) {
    const newFileName = `${slugify(this.name, {
      remove: /[\/*+~.()'"!:@]/g,
      lower: true
    })}.html`;
    const destinationDirectory = path.join(__dirname, path.relative(__dirname, destination), this.data.language || '', this.base);
    const absoluteDestinationPath = path.join(destinationDirectory, newFileName);
    return '/' + path.relative(getAbsolutePath(destination), absoluteDestinationPath);
  }
}