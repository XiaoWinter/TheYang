/*
 * @Author: XiaoWinter
 * @Date: 2021-09-05 22:44:25
 * @LastEditTime: 2021-09-14 00:31:33
 * @LastEditors: your name
 * @Description:
 * @FilePath: \TheYang\src\api\zhihu.ts
 */
import axios from "axios"

// 添加响应拦截器
axios.interceptors.response.use(
  function (response) {
    // 2xx 范围内的状态码都会触发该函数。
    // 对响应数据做点什么
    const {status, data} = response
    if (status !== 200) console.log("请求出错", response.data)

    return data
  },
  function (error) {
    // 超出 2xx 范围的状态码都会触发该函数。
    // 对响应错误做点什么
    return Promise.reject(error)
  }
)
/**
 * @description: 请求拦截器
 * @param {*}
 * @return {*}
 */
axios.interceptors.request.use(
  function (config) {
    // console.log(config)

    return config
  },
  function (config) {
    return Promise.reject(config)
  }
)

/**
 * @description: 专栏查询
 * @param {Options} options
 * @return {*}
 */
export async function getColumnById(options: Options): Promise<ZhihuData> {
  let {booksID, params} = options

  // https://www.zhihu.com/api/v4/columns/c_1371873380988166144/items
  return await axios.get(`https://www.zhihu.com/api/v4/columns/${booksID}/items`, {params})
}

/**
 * @description: 获取知乎文章
 * @param {*}
 * @return {*}
 */
export async function getArticles() {
  return await axios.get(`https://www.zhihu.com/api/v4/members/volunteertravel/articles`)
}
