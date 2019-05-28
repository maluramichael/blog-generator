import path from 'path';

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
}