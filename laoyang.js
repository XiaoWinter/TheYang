const axios = require('axios')
const fs = require('fs')
const path = require('path')

process.on('unhandledRejection', (reason, p) => {
    console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
    // application specific logging, throwing an error, or other logic here
  });



let params = {
        limit:10,
        offset:0
    }

async function getMatchedCSSRules(url){

    try {
        let result =  await axios.get(url,
            {params})
        
        // fs.writeFileSync()
        if(result.data){
            const art_list = result.data.data
            art_list.forEach(art => {
                
                let article_title = format_title(art.title)
                let author = format_title(art.author.name)

                const dir_path =  path.join(__dirname,'arts',author)
                
                if(!fs.existsSync(dir_path)){
                    fs.mkdirSync(dir_path,{ recursive: true })
                }

                const filepath = path.join(dir_path,article_title+'.md')
         

                console.log('获取',article_title)

                fs.writeFileSync(filepath,art.content)
            });
        }
        if(!result.data.paging.is_end){
            params.offset += 10
            getMatchedCSSRules(url)
        }
    } catch (error) {
        console.log(error)
        console.log('======================================'+params.offset+' ===============================================')
        params.offset += 10
        getMatchedCSSRules(url)
    }

}

function format_title(title){

    if(typeof title === 'string'){

        title = title.trim()
    
        const patrn = /[`~!@#$%^&*()_\-+=<>?:"{}|,.\/;'\\[\]·~！@#￥%……&*（）——\-+={}|《》？：“”【】、；‘'，。、]/img; 
    
        title = title.replace(patrn,'')
        
        return title
    }else{
        return '空'+ (new Date).valueOf()
    }

}

//知乎专栏收集

//Yang: https://www.zhihu.com/api/v4/columns/yangpingreview/items
// getMatchedCSSRules('https://www.zhihu.com/api/v4/columns/yangpingreview/items')
//雪碧  https://www.zhihu.com/api/v4/columns/fe-fantasy/items
// getMatchedCSSRules('https://www.zhihu.com/api/v4/columns/fe-fantasy/items')

