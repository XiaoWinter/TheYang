import axios from "axios";

// 添加响应拦截器
axios.interceptors.response.use(
  function (response) {
    // 2xx 范围内的状态码都会触发该函数。
    // 对响应数据做点什么
    const { status, data } = response;
    if (status !== 200) console.log("请求出错", response.data);

    return data;
  },
  function (error) {
    // 超出 2xx 范围的状态码都会触发该函数。
    // 对响应错误做点什么
    return Promise.reject(error);
  },
);

/**
 * @description: 专栏查询
 * @param {Options} options
 * @return {*}
 */
export async function getColumnById(options: Options): Promise<ZhihuData> {
  let { booksID, params } = options;
  params = params || {
    limit: 10,
    offset: 0,
  };
  // https://www.zhihu.com/api/v4/columns/c_1371873380988166144/items
  return await axios.get(
    `https://www.zhihu.com/api/v4/columns/${booksID}/items`,
    params,
  );
}

/**
 * @description: 获取知乎文章
 * @param {*}
 * @return {*}
 */
export async function getArticles() {
  return await axios.get(
    `https://www.zhihu.com/api/v4/members/volunteertravel/articles?include=data%5B*%5D.comment_count%2Csuggest_edit%2Cis_normal%2Cthumbnail_extra_info%2Cthumbnail%2Ccan_comment%2Ccomment_permission%2Cadmin_closed_comment%2Ccontent%2Cvoteup_count%2Ccreated%2Cupdated%2Cupvoted_followees%2Cvoting%2Creview_info%2Cis_labeled%2Clabel_info%3Bdata%5B*%5D.vessay_info%3Bdata%5B*%5D.author.badge%5B%3F%28type%3Dbest_answerer%29%5D.topics%3Bdata%5B*%5D.author.vip_info%3B&offset=20&limit=20&sort_by=created`,
    {
      headers: {
        cookie: `_zap=33ada75d-dfc4-4375-9c34-696ea3e5bd33; d_c0="APDfYZPJYhOPTlff34Pjkf3LzgP9h3DqeCA=|1625827025"; __snaker__id=16HWsEEmerXL5xrf; gdxidpyhxdE=WCi%5C9qGWLkE4NgGwaVXcinTDr%2Bh0tgqUQWECtspB2A4pH2VKkZkQnriB4n4GkzzXX7lq84ypOx18uzuwH%2B80yBA2Tn3Q%2Ba109%2F0g3tIk2zv%2BDPElyDpRoYqI9%2BmAa1L28wD7kZl5xH3X4tpDvz%2BDglT%2F%2FHj4JaqtgW%2FMfqSe4TP%2BA4ju%3A1625881099018; _9755xjdesxxd_=32; YD00517437729195%3AWM_NI=kiPtHCeGkf1CK4rO8RfPd0YQDjjpvESVmsTpwB3o4tpQMwAhxz%2FbxleB2%2BPCV%2Bb31y7hoKdIfG2XJyZAteJgL4TY4TtGlJbmxv98qYFWPRUNEO8r1dRY%2FkrtJ4pjqJpAS0Y%3D; YD00517437729195%3AWM_NIKE=9ca17ae2e6ffcda170e2e6ee8fb84da391bf84f061b89e8ab7d54f838b9eaef872a198a1a2d865978cbbafd32af0fea7c3b92aa9b7a095cb49a799a587b44989ecbeb0bb5aa690acd1dc5b88b6a691f54f918aa394d77cb59efd90b780b48f8398c464bca6e183fb68a79efeccd34996f5aed4b473f5b8a1ace743a699feb9c9739a9fbc86c96d90ec9cbab760b899a4abe167bcaaf7d9f4538689a0b3d8468791f893b4709287e18cf1808aecc08bf442b49f9dd1dc37e2a3; YD00517437729195%3AWM_TID=zSjdxEUX3j5AQUUVRVI%2BiNT8VA4RC%2BdO; z_c0="2|1:0|10:1625880231|4:z_c0|92:Mi4xZjdoTkRnQUFBQUFBOE45aGs4bGlFeVlBQUFCZ0FsVk5wMFRXWVFEU0JhWVQ1VkM3WFF2T2lUMzZlTy1tS1RfaWVB|febd1bd4b0b02f53d9c5cea685383d38d27b7b768a8be80f2cd651643f9c36e5"; tshl=; __utmv=51854390.100--|2=registration_date=20190214=1^3=entry_date=20190214=1; _xsrf=yQMTCd4ctRbFnwc3WmjivJzKbEFIzDLP; q_c1=0ddb8812e8854c458586ffca06ffbf49|1629697776000|1626845244000; __utma=51854390.1051282883.1628060712.1628060712.1629860970.2; __utmc=51854390; __utmz=51854390.1629860970.2.2.utmcsr=zhihu.com|utmccn=(referral)|utmcmd=referral|utmcct=/question/481570057/answer/2077709676; SESSIONID=XkUDiuLNAOF29XhF3gaWETRmpL74ub2kSvoFeqvecsw; JOID=WlscBU3GuNP078ObIcjdTYmLWf0zldmJsIi93WCJ_J_J1pX4bXav-pvqwp4uPJ3u8HBaIWpbADu22JVjeU3mQ2I=; osd=Ul8RBU_OvN707cufLMjfRY2GWf87kdSJsoC50GCL9JvE1pfwaXuv-JPuz54sNJnj8HJSJWdbAjOy1ZVhcUnrQ2A=; Hm_lvt_98beee57fd2ef70ccdd5ca52b9740c49=1629879799,1629885533,1629890228,1629891344; tst=f; Hm_lpvt_98beee57fd2ef70ccdd5ca52b9740c49=1629892116; KLBRSID=b33d76655747159914ef8c32323d16fd|1629892132|1629879798`,
        ["x-ab-pb"]: `CrgBaASmASoDeQS5AswC4QNXBH0CwgLHAg4EKgKiA2kBRQNFBIUEOwLKAvYCtAoBC5sL9ANCBJ0EngTgC8ECoANsBMAC3AsHDE8BNAxkBNcLcgOrAwkEiwRAAYkCVwO0AGALdAHPC4kMTQRpBLULMgP4AwoE9AtPA0MEPwBsA7cD6APYAjQEagTXAqED6gNqAYwCnwI3DFILhAJQA6cEVgxtAioE5AozBOwKRwAIBA8LGwDzA10EQwCOAxJcAAABABUBAAABAAADAAABAAAAAQAAAAACAAABAAABAAABAAEAAAAAAQAAAAEEBgAAAAsAAAADAAQBAAAAAAAAAAAAAAAACwAAAQEBAAAZAQkAAAABAAABAAAAFQA=`,
      },
    },
  );
}
