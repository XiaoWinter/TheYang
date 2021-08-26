import { getColumnById, getArticles } from "../api/zhihu";

async function testGetColumnById() {
  const data = await getColumnById({ booksID: "shiji" });
  console.log("data", data);
}

async function testGetArticles() {
  const data = await getArticles();
  console.log("data", data);
}
testGetColumnById();

// testGetArticles();
