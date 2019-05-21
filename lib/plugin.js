module.exports = class Plugin {
  name = 'BasePlugin';

  register() {
  }

  run() {
    return new Promise((resolve) => resolve());
  }
}