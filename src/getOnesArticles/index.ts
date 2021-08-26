import * as fs from "fs";
import * as path from "path";

import { formatTitle, waitRandom } from "../utils";

import { getColumnById } from "../api/zhihu";

process.on("unhandledRejection", (reason, p) => {
  console.log("Unhandled Rejection at: Promise", p, "reason:", reason);
  // application specific logging, throwing an error, or other logic here
});

type Options = {
  limit: number;
  offset: number;
};

const params: Options = {
  limit: 10,
  offset: 0,
};

async function getOnesArticles(booksID: string) {
  try {
    console.log("params", params);
    let data = await getColumnById({ booksID, params });

    if (!data) return;

    const {
      data: artList,
      paging: { is_end, totals },
    } = data;

    const { offset } = params;
    console.log("is_end", is_end);
    console.log("totals", totals);

    artList.forEach((articleInfo, index) => {
      let {
        title,
        author: { name },
        content,
      } = articleInfo;
      title = formatTitle(title);
      name = formatTitle(name);

      const dirPath = path.join(__dirname, "../../", "arts", name);

      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      const filepath = path.join(dirPath, title + ".md");
      console.log(`获取专栏文章${index + offset + 1} ${name}: ${title}`);
      fs.writeFileSync(filepath, content);
    });

    if (!is_end && totals >= offset + 10) {
      params.offset += 10;
      waitRandom(getOnesArticles)(booksID);
    }
  } catch (error) {
    // console.log(error);
    console.log(
      `======================================${params.offset}===============================================`,
    );
    params.offset += 1;
    if (params.offset > 10000) return;
    waitRandom(getOnesArticles)(booksID);
  }
}

// getOnesArticles("https://www.zhihu.com/api/v4/columns/yangpingreview/items");

//知乎专栏收集

//Yang: https://www.zhihu.com/api/v4/columns/yangpingreview/items
// getOnesArticles('https://www.zhihu.com/api/v4/columns/yangpingreview/items')
//雪碧  https://www.zhihu.com/api/v4/columns/fe-fantasy/items
// https://www.zhihu.com/api/v4/columns/shiji/items
// shiji
// c_112043819
// c_158005898
// c_1207740498943029248
// c_1371873380988166144
// getOnesArticles(
//   "https://www.zhihu.com/api/v4/columns/c_1371873380988166144/items",
// );

export default getOnesArticles;
