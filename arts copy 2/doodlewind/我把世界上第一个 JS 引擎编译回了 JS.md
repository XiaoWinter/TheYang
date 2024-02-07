<p data-pid="e8pNgO5C">1995 年，在我刚满周岁的时候，大洋彼岸有个叫 Brendan Eich 的人在十天内创造了一门今天我正以它谋生的编程语言，这就是 JavaScript。</p><p data-pid="OUCbcdj2">这个快速创造 JavaScript 的故事在程序员群体中广为流传。但对于今天的人们来说，或许已经没有多少人记得（甚至体验过）最早的 JavaScript 是什么样的，更不要说阅读当年的 JS 引擎源码了。</p><p data-pid="PabZ8u5R">不过在 2020 年，我们迎来了一个了解这段历史的契机。在研究编程语言历史的 HOPL-IV 学术会议上，由 Brendan Eich 和 ES6 首席作者 Allen Wirfs-Brock 联手撰写的《<a href="http://link.zhihu.com/?target=https%3A//github.com/doodlewind/jshistory-cn" class=" wrap external" target="_blank" rel="nofollow noreferrer">JavaScript 20 年</a>》详细介绍了 JS 诞生和演化的历史。作为这本书的中文版译者，我逐个校订了超过原版中超过 600 条参考文献链接，其中正有一条指向了最早的 JS 引擎源码。这激发了我的好奇心——最早的 JS 引擎代码，今天还能不能编译运行？如果可以的话，能不能更进一步地把它编译回 JavaScript，让它在 Web 上复活呢？因此我进行了这次尝试。</p><p data-pid="SBaC5kY3">最早的 JS 引擎名为 Mocha（这是 Netscape 内部的网页脚本语言项目代号），由 Brendan Eich 在 1995 年 5 月完成了首个原型。在 1995 年全年和 1996 年的大部分时间里，Eich 都是仅有的全职负责 JavaScript 引擎的开发者。直到 1996 年 8 月发布 Netscape 3.0 时，Mocha 的代码库主要包含的仍然是这个原型中的代码。随 Netscape 3.0 发布的 JS 版本被称为 JavaScript 1.1，这个版本标志着 JavaScript 的初始阶段开发工作得以完成。在此之后，Eich 又花了两周时间重写了 Mocha，获得了一个更强的引擎，这就是今天 Firefox 搭载的 SpiderMonkey。</p><p data-pid="YHDayLoL">如果你谷歌搜索「Netscape source code」，大概只能追溯到 1998 年 Mozilla 项目中的 SpiderMonkey 引擎代码。而真正的 Mocha 引擎源码，则位于网络上一份（来路不明的）Netscape 3.0.2 浏览器源码的压缩包中。但 Mocha 的源码早已在 Eich 重写 SpiderMonkey 后被彻底放弃，该怎样复活它呢？</p><p data-pid="YvXdh7QK">其实想了解任何软件，其手段都无非「自顶向下」和「自底向上」两条路。前者从架构层面入手了解宏观知识，后者从代码层面入手解决微观问题。由于我已经比较熟悉对 QuickJS 等 JS 引擎的使用，因此这里我直接选择了自底向上的实践手段。其基本的理念很简单：<b>渐进地编译出引擎的各个模块，最后把它组合在一起跑起来</b>。</p><p data-pid="27dHVXPJ">原版 Mocha 采用 Makefile 作为构建系统，但它显然已经无法在今天的操作系统中正确工作了——那可是个 MacOS 还在使用 PPC 处理器的时代！但说到底，构建系统只不过是一个自动执行 <code>gcc</code> 和 <code>clang</code> 等编译器的辅助工具而已。而 C 语言项目的编译过程，概括说来也无非这么几件事：</p><ol><li data-pid="cE8Vtobx">用 <code>gcc -c</code> 命令，逐个将「作为库被使用」的 <code>.c</code> 源码编译为 <code>.o</code> 格式的对象文件。这会把 C 源码中的每个函数都编译成二进制可执行文件中的所谓「符号」，就像是 ES Module 中 <code>export</code> 出来的函数那样。注意在这个时候，每个对象文件中都可以任意调用以 <code>.h</code> 形式引入的其他库的 API。此时编译不会出错，只会在对象文件中记录对外部符号的调用。</li><li data-pid="RaZfi4yS">用 <code>ar</code> 命令把这些 <code>.o</code> 对象文件制作成 <code>.a</code> 格式的静态库。这其实只相当于简单的文件拼接组装而已，获得的 <code>.a</code> 文件中会包含项目中所有的符号，类似于 <code>cat *.js &gt;&gt; all.js</code> 的效果。另外我们还可以制作更节约空间的动态库，但相对比较复杂，这里略过。</li><li data-pid="ZfYJ-Q5V">用 <code>gcc -l</code> 命令编译出「调用这个库」的 <code>.c</code> 源码，这时编译器会将其产物与 <code>.a</code> 静态库相链接。链接器会把各个对象文件中形同「榫卯结构」式的符号依赖连接起来。这时对于第一步中的每个对象文件，其中所有调用外部 API 的符号都必须能被链接器找到，缺失任何一个符号都会导致链接失败——但只要链接成功，我们就最终获得了以 <code>main</code> 函数为入口的可执行文件。</li></ol><p data-pid="-2vW2Xzy">因此，整个渐进的移植过程是这样的：</p><ol><li data-pid="mZcv1e6b">编译出每份 Mocha 内部的（即除了入口之外的）<code>.c</code> 源码文件，获得包含其符号的 <code>.o</code> 格式对象文件。</li><li data-pid="Uzm64zwG">将包含这些符号的 <code>.o</code> 对象文件拼接起来，打包出 <code>.a</code> 格式的静态库文件，即 <code>libmocha.a</code>。</li><li data-pid="Z76TIuOw">编译 Mocha 入口的 <code>mo_shell.c</code> 文件，将其与 <code>libmocha.a</code> 静态库相链接，获得最终的可执行文件。</li></ol><p data-pid="f_DgzIVP">在这个过程中，需要处理一些外部依赖，其中最典型的是对 <code>prxxx.h</code> 的依赖。这是 Netscape 当年开发的 <a href="http://link.zhihu.com/?target=https%3A//developer.mozilla.org/en-US/docs/Mozilla/Projects/NSPR/About_NSPR" class=" wrap external" target="_blank" rel="nofollow noreferrer">Netscape Portable Runtime</a> 跨平台标准库，其中实现了一些通用的宏定义与类型定义，以及 C 的哈希表、链表等基础数据结构，还有某些数学计算、时间转换等功能。NSPR 的源码也附带在了 Netscape 3 的源码中，但我并没有一次性把它们全部提交进新的移植版 Mocha 代码库。这里的处理方式是仅在遇到缺失的 NSPR 依赖时，才手动将涉及到的 NSPR 头文件和源码递归地引入，从而剥离出一份最小可用的 Mocha 代码树。</p><p data-pid="-L-onX4j">整个移植过程中涉及到的源码改动，主要包括这些：</p><ul><li data-pid="TNuiBUbE">移除掉 <code>prcpucfg.h</code>，直接使用 x86 和 WASM 的小端字节序。</li><li data-pid="SJfseIvY">修订 <code>prtypes.h</code> 中的类型定义，用 C99 标准中的 <code>uint16_t</code> 代替 <code>unsigned short</code> 等存在兼容问题的类型，类似的还有 <code>Bool</code> 类型。</li><li data-pid="C0JIUtpf">补充 <code>MOCHAFILE</code> 宏，强制令 Mocha 进入读取文件的命令行模式，而不是浏览器中所使用的嵌入模式。</li><li data-pid="aZITXO1A">补充部分代码中缺失的 <code>include</code> 引用。</li></ul><p data-pid="rldyeqk_">最后，我只用一个非常简单的 bash 脚本，就成功编译出了 Mocha 的全部模块。相信只要正经学过几天 C 语言就能搞明白：</p><div class="highlight"><pre><code class="language-text"><span></span>function compile_objs() {
    echo "compiling OBJS..."
    $CC -Iinclude src/mo_array.c -c -o out/mo_array.o
    $CC -Iinclude src/mo_atom.c -c -o out/mo_atom.o
    $CC -Iinclude src/mo_bcode.c -c -o out/mo_bcode.o
    $CC -Iinclude src/mo_bool.c -c -o out/mo_bool.o
    $CC -Iinclude src/mo_cntxt.c -c -o out/mo_cntxt.o
    $CC -Iinclude src/mo_date.c -Wno-dangling-else -c -o out/mo_date.o
    $CC -Iinclude src/mo_emit.c -c -o out/mo_emit.o
    $CC -Iinclude src/mo_fun.c -c -o out/mo_fun.o
    $CC -Iinclude src/mo_math.c -c -o out/mo_math.o
    $CC -Iinclude src/mo_num.c -Wno-non-literal-null-conversion -c -o out/mo_num.o
    $CC -Iinclude src/mo_obj.c -c -o out/mo_obj.o
    $CC -Iinclude src/mo_parse.c -c -o out/mo_parse.o
    $CC -Iinclude src/mo_scan.c -c -o out/mo_scan.o
    $CC -Iinclude src/mo_scope.c -c -o out/mo_scope.o
    $CC -Iinclude src/mo_str.c -Wno-non-literal-null-conversion -c -o out/mo_str.o
    $CC -Iinclude src/mocha.c -c -o out/mocha.o
    $CC -Iinclude src/mochaapi.c -Wno-non-literal-null-conversion -c -o out/mochaapi.o
    $CC -Iinclude src/mochalib.c -c -o out/mochalib.o
    $CC -Iinclude src/prmjtime.c -c -o out/prmjtime.o
    $CC -Iinclude src/prtime.c -c -o out/prtime.o
    $CC -Iinclude src/prarena.c -c -o out/prarena.o
    $CC -Iinclude src/prhash.c -c -o out/prhash.o
    $CC -Iinclude src/prprf.c -c -o out/prprf.o
    $CC -Iinclude src/prdtoa.c \
        -Wno-logical-not-parentheses \
        -Wno-shift-op-parentheses \
        -Wno-parentheses \
        -c -o out/prdtoa.o
    $CC -Iinclude src/log2.c -c -o out/log2.o
    $CC -Iinclude src/longlong.c -c -o out/longlong.o
}
</code></pre></div><p data-pid="9ZFcZ4zg">当然在这中途抛出的编译器警告中，我也看到了一些不讲武德的代码。比如 <code>mo_date.c</code> 里的这个：</p><div class="highlight"><pre><code class="language-c"><span></span><span class="k">if</span> <span class="p">(</span><span class="n">i</span> <span class="o">&lt;=</span> <span class="n">st</span> <span class="o">+</span> <span class="mi">1</span><span class="p">)</span>
    <span class="k">goto</span> <span class="n">syntax</span><span class="p">;</span>
<span class="k">for</span> <span class="p">(</span><span class="n">k</span> <span class="o">=</span> <span class="p">(</span><span class="k">sizeof</span><span class="p">(</span><span class="n">wtb</span><span class="p">)</span><span class="o">/</span><span class="k">sizeof</span><span class="p">(</span><span class="kt">char</span><span class="o">*</span><span class="p">));</span> <span class="o">--</span><span class="n">k</span> <span class="o">&gt;=</span> <span class="mi">0</span><span class="p">;)</span>
    <span class="k">if</span> <span class="p">(</span><span class="n">date_regionMatches</span><span class="p">(</span><span class="n">wtb</span><span class="p">[</span><span class="n">k</span><span class="p">],</span> <span class="mi">0</span><span class="p">,</span> <span class="n">s</span><span class="p">,</span> <span class="n">st</span><span class="p">,</span> <span class="n">i</span><span class="o">-</span><span class="n">st</span><span class="p">,</span> <span class="mi">1</span><span class="p">))</span> <span class="p">{</span>
        <span class="kt">int</span> <span class="n">action</span> <span class="o">=</span> <span class="n">ttb</span><span class="p">[</span><span class="n">k</span><span class="p">];</span>
        <span class="k">if</span> <span class="p">(</span><span class="n">action</span> <span class="o">!=</span> <span class="mi">0</span><span class="p">)</span>
            <span class="k">if</span> <span class="p">(</span><span class="n">action</span> <span class="o">==</span> <span class="mi">1</span><span class="p">)</span> <span class="cm">/* pm */</span>
                <span class="k">if</span> <span class="p">(</span><span class="n">hour</span> <span class="o">&gt;</span> <span class="mi">12</span> <span class="o">||</span> <span class="n">hour</span> <span class="o">&lt;</span> <span class="mi">0</span><span class="p">)</span>
                    <span class="k">goto</span> <span class="n">syntax</span><span class="p">;</span>
                <span class="k">else</span>
                    <span class="n">hour</span> <span class="o">+=</span> <span class="mi">12</span><span class="p">;</span>
            <span class="k">else</span> <span class="nf">if</span> <span class="p">(</span><span class="n">action</span> <span class="o">&lt;=</span> <span class="mi">13</span><span class="p">)</span> <span class="cm">/* month! */</span>
                <span class="k">if</span> <span class="p">(</span><span class="n">mon</span> <span class="o">&lt;</span> <span class="mi">0</span><span class="p">)</span>
                    <span class="n">mon</span> <span class="o">=</span> <span class="cm">/*byte*/</span> <span class="p">(</span><span class="n">action</span> <span class="o">-</span> <span class="mi">2</span><span class="p">);</span>
                <span class="k">else</span>
                    <span class="k">goto</span> <span class="n">syntax</span><span class="p">;</span>
            <span class="k">else</span>
                <span class="n">tzoffset</span> <span class="o">=</span> <span class="n">action</span> <span class="o">-</span> <span class="mi">10000</span><span class="p">;</span>
        <span class="k">break</span><span class="p">;</span>
    <span class="p">}</span>
<span class="k">if</span> <span class="p">(</span><span class="n">k</span> <span class="o">&lt;</span> <span class="mi">0</span><span class="p">)</span>
<span class="k">goto</span> <span class="n">syntax</span><span class="p">;</span>
</code></pre></div><p data-pid="aV6E2pfc">也有很多注释提醒着我这个项目的悠久历史，比如 <code>mocha.c</code> 里的这个：</p><div class="highlight"><pre><code class="language-c"><span></span><span class="cm">/*</span>
<span class="cm">** Mocha virtual machine.</span>
<span class="cm">**</span>
<span class="cm">** Brendan Eich, 6/20/95</span>
<span class="cm">*/</span>
</code></pre></div><p data-pid="BIBlDAHO">另外我也找到了一些体现 1995 年混沌兼容性问题的代码。它们让我更理解当时的人们为什么会期待「一次编写，到处运行」的 Java 了：</p><div class="highlight"><pre><code class="language-c"><span></span><span class="cp">#if defined(AIXV3)</span>
<span class="cp">#include</span> <span class="cpf">"os/aix.h"</span><span class="cp"></span>

<span class="cp">#elif defined(BSDI)</span>
<span class="cp">#include</span> <span class="cpf">"os/bsdi.h"</span><span class="cp"></span>

<span class="cp">#elif defined(HPUX)</span>
<span class="cp">#include</span> <span class="cpf">"os/hpux.h"</span><span class="cp"></span>

<span class="cp">#elif defined(IRIX)</span>
<span class="cp">#include</span> <span class="cpf">"os/irix.h"</span><span class="cp"></span>

<span class="cp">#elif defined(LINUX)</span>
<span class="cp">#include</span> <span class="cpf">"os/linux.h"</span><span class="cp"></span>

<span class="cp">#elif defined(OSF1)</span>
<span class="cp">#include</span> <span class="cpf">"os/osf1.h"</span><span class="cp"></span>

<span class="cp">#elif defined(SCO)</span>
<span class="cp">#include</span> <span class="cpf">"os/scoos.h"</span><span class="cp"></span>

<span class="cp">#elif defined(SOLARIS)</span>
<span class="cp">#include</span> <span class="cpf">"os/solaris.h"</span><span class="cp"></span>

<span class="cp">#elif defined(SUNOS4)</span>
<span class="cp">#include</span> <span class="cpf">"os/sunos.h"</span><span class="cp"></span>

<span class="cp">#elif defined(UNIXWARE)</span>
<span class="cp">#include</span> <span class="cpf">"os/unixware.h"</span><span class="cp"></span>

<span class="cp">#elif defined(NEC)</span>
<span class="cp">#include</span> <span class="cpf">"os/nec.h"</span><span class="cp"></span>

<span class="cp">#elif defined(SONY)</span>
<span class="cp">#include</span> <span class="cpf">"os/sony.h"</span><span class="cp"></span>

<span class="cp">#elif defined(NCR)</span>
<span class="cp">#include</span> <span class="cpf">"os/ncr.h"</span><span class="cp"></span>

<span class="cp">#elif defined(SNI)</span>
<span class="cp">#include</span> <span class="cpf">"os/reliantunix.h"</span><span class="cp"></span>
<span class="cp">#endif</span>
</code></pre></div><p data-pid="rETDJ8K5">幸运的是，这些 C 代码都能顺利通过编译。这里为了保留历史遗迹，没有做画蛇添足的多余改动。而在获得全部对象文件后，只要用下面这几行 bash 脚本，就能链接出 Mocha 的可执行文件了！</p><div class="highlight"><pre><code class="language-text"><span></span>function compile_native() {
    export CC=clang
    export AR=ar
    compile_objs
    echo "linking..."
    $AR -rcs out/libmocha.a out/*.o
    $CC -Iinclude -Lout -lmocha tests/mo_shell.c -o out/mo_shell
    echo "mocha shell compiled!"
}
</code></pre></div><p data-pid="ggqIrmAe">获得 Mocha 的原生版本之后，该怎样获得它的 WASM 版本呢？非常简单，只要把原生编译器 <code>gcc</code>（在 macOS 上其实是 <code>clang</code>）换成 WASM 编译器 <code>emcc</code> 就可以了！这个 Emscripten 编译器支持 JavaScript 和 WASM 作为编译后端，切换输出格式不过是改一个编译参数的事情：</p><div class="highlight"><pre><code class="language-text"><span></span>function compile_web() {
    export CC=emcc
    export AR=emar
    compile_objs
    echo "linking..."
    $AR -rcs out/libmocha.a out/*.o
    $CC -Iinclude -Lout -lmocha tests/mo_shell.c \
        --shell-file src/shell.html \
        -s NO_EXIT_RUNTIME=0 \
        -s WASM=$1 \
        -O2 \
        -o $2
    echo "mocha shell compiled!"
}

function compile_js() {
    compile_web 0 out/mocha_shell_js.html
}

function compile_wasm() {
    compile_web 1 out/mocha_shell_wasm.html
}
</code></pre></div><p data-pid="XY1lU9F6">在获得可用的 Mocha 引擎后，我没有重新编写 Makefile。因为我发现这个完全手动实现的 bash 脚本虽然不具备增量编译的能力，但也非常简单易用，可以很方便地构建出不同的编译产物：</p><div class="highlight"><pre><code class="language-text"><span></span>$ source build.sh

# build WASM
$ compile_wasm

# build js
$ compile_js

# build native
$ compile_native
</code></pre></div><p data-pid="wCxCX26G">不过，Emscripten 编译产物默认的侵入性很强，其输出本身是一个「只要打开页面就会立刻同步执行 WASM 内容」的 HTML。该如何使其接受文本框的用户输入呢？为了简单起见，这里直接将 WASM 引擎页面嵌入了一个 iframe 中。每次点击页面上的 Run 按钮，都会先将输入框内容插入 localStorage，然后重新加载相应的 WASM iframe 页面，在其中同步地读取 localStorage 内的字符串 JS 脚本内容作为（Emscripten 模拟出的）stdin 的标准输入，最后自动启动 Mocha 解释执行。</p><p data-pid="LP-5CjAj">这个过程很简单，相信任何一个普通的前端开发者都可以轻松地实现出来。这是最后的效果：</p><figure data-size="normal"><img src="https://picx.zhimg.com/v2-9c87ae0b55b83cc826b417617b7bb30f_720w.jpg?source=d16d100b" data-caption="" data-size="normal" data-rawwidth="1644" data-rawheight="838" class="origin_image zh-lightbox-thumb" width="1644" data-original="https://pic1.zhimg.com/v2-9c87ae0b55b83cc826b417617b7bb30f_720w.jpg?source=d16d100b"></figure><p data-pid="txvmlLcp">这样就大功告成了！我们重新把世界上第一个 JS 引擎安装回了浏览器里！</p><p data-pid="rNXkNqUv">从开始移植 Mocha 源码到上线 WASM 版本，只花了我不到三天的业余时间。因此个人认为当年的 Mocha 引擎较好地考虑了可移植性和可维护性，具有不错的工程质量。但诸如引用计数等基础设计使其存在固有的性能瓶颈，因此后来需要重写，这就是另一个故事了。</p><p data-pid="55-y3eEn">本文写作时，正好处于 JavaScript 正式发布 25 周年之际（1995 年 12 月 4 日，Netscape 与 Sun 召开联合发布会）。而介绍那次事件的新闻稿，也是《JavaScript 20 年》中的一份附件。作为中国的前端开发者，我很高兴能看到这本书在国内获得了不错的反响（个人相关文章共计约 6 万阅读量，<a href="http://link.zhihu.com/?target=https%3A//github.com/doodlewind/jshistory-cn" class=" wrap external" target="_blank" rel="nofollow noreferrer">GitHub 翻译项目</a> 2.2k star）。有趣的是，JS 之父 Brendan Eich 的推特头像上也写着中文，可惜上面只能看到「無一」两个字，看起来像是在练混元形意太极拳：</p><figure data-size="normal"><img src="https://picx.zhimg.com/v2-1bf49d0e873d840eaa6da701035b5873_720w.jpg?source=d16d100b" data-caption="" data-size="normal" data-rawwidth="1172" data-rawheight="424" class="origin_image zh-lightbox-thumb" width="1172" data-original="https://pic1.zhimg.com/v2-1bf49d0e873d840eaa6da701035b5873_720w.jpg?source=d16d100b"></figure><p data-pid="ml9G1Byk">不过托 <a class="member_mention" href="http://www.zhihu.com/people/596c0a5fdd9b36cea06bac348d418824" data-hash="596c0a5fdd9b36cea06bac348d418824" data-hovercard="p$b$596c0a5fdd9b36cea06bac348d418824">@顾轶灵</a> 的福，我找到了 Eich 头像的原图。你看这里的汉字并不是玄学，而是一段程序员的心灵鸡汤，写的是「越多人贡献心力，对整个生态系的发展有益无害，开源俨然已成了一种文化」——</p><figure data-size="normal"><img src="https://picx.zhimg.com/v2-2a849906f9fdc629f1842bae5c29242e_720w.jpg?source=d16d100b" data-caption="" data-size="normal" data-rawwidth="960" data-rawheight="420" class="origin_image zh-lightbox-thumb" width="960" data-original="https://picx.zhimg.com/v2-2a849906f9fdc629f1842bae5c29242e_720w.jpg?source=d16d100b"></figure><p data-pid="0oAmvhVP">今天我们这次小小的实践，也算是这种文化的一种体现吧。</p><p data-pid="WLY18m1k">C 语言之父 Dennis Ritchie 说，成功的方式是靠运气——「你要出现在正确的时间和正确的地点，然后让自己被后人所延续。」而 JavaScript 也正是这样的。这门语言已经在 SpaceX 龙飞船上支撑起了人类首个宇宙飞船中的 GUI，甚至即将随着詹姆斯韦伯太空望远镜飞向远方。但当我们回顾这一切的起点时，那个带着不少瑕疵的 1995 年版 Mocha 引擎，无疑出现在了正确的时间和正确的地点——否则我们今天写的大概将会是 VBScript。</p><p data-pid="Km65IqOd">在 2020 年结束之际回顾 1995，那真像是个不可思议的时代：WTO 成立，申根协议生效，中国劳动法施行，Windows 95、Java 和 JavaScript 陆续发布。而四分之一个世纪过去后，有些东西进步了，有些东西天翻地覆了，但也有些东西恐怕再也回不来了。</p><p data-pid="gFwx7bey">忘记那些糟心事吧。就在今天，让我们为 1995 干杯，为 2020 干杯，为 JavaScript 干杯吧。</p><p data-pid="eQGaMZv1">传送门：<a href="http://link.zhihu.com/?target=https%3A//github.com/doodlewind/mocha1995" class=" wrap external" target="_blank" rel="nofollow noreferrer">Mocha 1995</a></p>