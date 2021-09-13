/*
 * @Author: XiaoWinter
 * @Date: 2021-09-05 22:44:25
 * @LastEditTime: 2021-09-14 00:40:10
 * @LastEditors: your name
 * @Description:
 * @FilePath: \TheYang\src\test\zhihu.ts
 */
import {getColumnById, getArticles} from "../api/zhihu"

async function testGetColumnById() {
  const data = await getColumnById({booksID: "shiji", params: {limit: 20, offset: 10}})
  console.log("data", data)
}

/**
 * @description: 获取文章的接口不太能调
 * @param {*}
 * @return {*}
 */
async function testGetArticles() {
  const data = await getArticles()
  console.log("data", data)
}
testGetColumnById()

// testGetArticles()
