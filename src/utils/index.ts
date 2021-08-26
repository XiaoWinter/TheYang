import config from "../config";

/**
 * @description: 将标题转化为可作为文件名的标题
 * @param {any} title
 * @return {*}
 */
export function formatTitle(title: any): string {
  if (typeof title !== "string") return "空" + new Date().valueOf();

  title = title.trim();

  const patrn =
    /[`~!@#$%^&*()_\-+=<>?:"{}|,.\/;'\\[\]·~！@#￥%……&*（）——\-+={}|《》？：“”【】、；‘'，。、]/gim;

  title = title.replace(patrn, "");

  return title;
}

/**
 * @description: 避免请求过快被当成爬虫
 * @param {Function} func
 * @param {number} waitTime
 * @return {*}
 */
export function waitRandom(func: Function, waitTime?: number): Function {
  let delay = config.waitTime || waitTime || 5000;
  return (...args: any) => {
    setTimeout(() => {
      func(args);
    }, Math.random() * delay);
  };
}
