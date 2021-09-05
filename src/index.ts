#!/usr/bin/env node
import * as inquirer from "inquirer"
import getOnesArticles from "./getOnesArticles"
import {waitRandom} from "./utils"
inquirer
  .prompt([
    {
      type: "input",
      name: "booksID",
      message: "请输入专栏ID",
    },
  ])
  .then((answers) => {
    const defaultIDs = [
      "yangpingreview", // 弗兰克扬 扬评书斋
      "fe-fantasy", // doodlewind 前端随想录
      "forward-comrades", // doodlewind 前进达瓦里希
      "shiji", // 林先生 史记札记
      "c_112043819", // 林先生 思辩的力量
      "c_158005898", // 林先生 那烂陀寺
      "c_1207740498943029248", // 林先生 林先生的学科笔记
      "c_1371873380988166144", // 林先生 中正书堂
      "c_202993109", // 霍华德 工程学之美
    ]
    const {booksID} = answers

    if (!booksID) {
      defaultIDs.forEach((id) => waitRandom(getOnesArticles)(id))
    } else {
      waitRandom(getOnesArticles)(booksID)
    }
  })
  .catch((error) => {
    console.log(error)
  })
