const commander = require('commander');
const program = new commander.Command();
program.version('0.0.1');

import { build } from './lib/index';

program.command('build').action(async (cmd) => {
  await build({
    source: 'myPage'
  });
});

program.parse(process.argv);
