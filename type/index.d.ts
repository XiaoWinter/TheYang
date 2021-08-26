/**
 * @description: 专栏
 */
type ArticleInfo = {
  updated: number;
  is_labeled: boolean;
  copyright_permission: string;
  excerpt: string;
  admin_closed_comment: boolean;
  article_type: string;
  reason: string;
  title_image: string;
  excerpt_title: string;
  id: number;
  voteup_count: number;
  voting: number;
  author: { name: string; email: string };
  url: string;
  comment_permission: string;
  has_column: boolean;
  state: string;
  created: number;
  content: string;
  comment_count: number;
  image_url: string;
  title: string;
  can_comment: object;
  type: string;
  suggest_edit: object;
};
/**
 * @description: 专栏接口返回
 */
type ZhihuData = {
  data: ArticleInfo[];

  paging: {
    is_end: boolean;
    totals: number;
    previous: string;
    is_start: boolean;
    next: string;
  };
};
/**
 * @description: 普通配置对象
 */
type Options = {
  [key: string]: any;
};

/**
 * @description: 配置文件类型
 */
type Config = {
  waitTime?: number;
};
