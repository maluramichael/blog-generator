import path from 'path';

module.exports = class Page {
  constructor(name, path, base = '.', data = {}) {
    this.name = name;
    this.path = path;
    this.base = base;
    this.data = data;
  }

  getFileType() {
    return path.extname(this.path).replace('.', '');
  }
}