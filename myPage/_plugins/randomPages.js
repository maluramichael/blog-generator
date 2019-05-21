import Generator from '../../lib/generator';
import Page from '../../lib/page';

module.exports = class RandomPages extends Generator {
  run(context) {
    return new Promise(async (resolve, reject) => {

      const pages = [
        //new Page('index', '_template/randomPage.ejs', '2019/05/30', {})
      ];

      resolve({ ...context, pages: [...context.pages, ...pages] });
    })
  }
}