function format_title(title){
    title = title.trim()

    const patrn = /[`~!@#$%^&*()_\-+=<>?:"{}|,.\/;'\\[\]·~！@#￥%……&*（）——\-+={}|《》？：“”【】、；‘'，。、]/img; 

    title = title.replace(patrn,'')
    
    return title
}


console.log(format_title("h？?\i、o“<'h'o>"))