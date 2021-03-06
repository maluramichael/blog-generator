const commander = require('commander');
const chokidar = require('chokidar');
import fs from 'fs';
import path from 'path';
import {
  debounce
} from 'debounce';
import browserSync from 'browser-sync';

import Builder from './lib/index';

const program = new commander.Command();
program.version('0.0.1');

const watchOptions = {
  ignored: ['node_modules/**', '.git/**', 'build/**']
};


program.command('build <source> <destination>').option('-f, --fresh').action(async (source, destination, cmd) => {
  const {
    fresh
  } = cmd.opts();

  const config = JSON.parse(fs.readFileSync(path.join(source, 'config.json')));
  const newConfig = {
    ...config,
    source,
    destination,
    fresh
  };

  console.log(source);
  const builder = new Builder(newConfig);
  // builder.build();
});

program.command('watch').action(async (cmd) => {
  // const watcher = chokidar.watch('.', watchOptions);
  // watcher.on('all', (event, path) => runBuild(config));
});

program.command('serve <source>').action(async (source, cmd) => {
  const config = JSON.parse(fs.readFileSync(path.join(source, 'config.json')));
  const builder = new Builder({
    ...config,
    source
  });
  const triggerReload = debounce((instance) => instance.reload(), 100);

  const syncInstance = browserSync.create('blog');
  syncInstance.init({
    server: builder.context.config.destination
  });

  builder.watch();
  builder.on('change', (event, file) => triggerReload(syncInstance));
});

program.parse(process.argv);