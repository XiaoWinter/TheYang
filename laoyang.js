const axios = require('axios')
const fs = require('fs')

process.on('unhandledRejection', (reason, p) => {
    console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
    // application specific logging, throwing an error, or other logic here
  });



let params = {
        limit:10,
        offset:0
    }

async function getMatchedCSSRules(){

    try {
        let result =  await axios.get('https://www.zhihu.com/api/v4/columns/yangpingreview/items',
            {params})
        
        // fs.writeFileSync()
        if(result.data){
            const art_list = result.data.data
            art_list.forEach(art => {
                
                let article_title = format_title(art.title)

                const path = __dirname+'\\arts\\'+article_title+'.md'

                console.log('获取',article_title)

                fs.writeFileSync(path,art.content)
            });
        }
        if(!result.data.paging.is_end){
            params.offset += 10
            getMatchedCSSRules()
        }
    } catch (error) {
        console.log(error)
        console.log('======================================'+params.offset+' ===============================================')
        params.offset += 10
        getMatchedCSSRules()
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
getMatchedCSSRules()

