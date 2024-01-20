<p>V8 和 Node.js 的关系，是许多前端同学们所津津乐道的——浏览器里的语言，又兼容了浏览器外的环境，两份快乐重叠在一起。而这两份快乐，又带来了更多的快乐……但你有没有想过，这两份快乐到底是如何重叠在一起的呢？下面我们将以嵌入式 JS 引擎 QuickJS 为例，介绍一个 JS 引擎是如何被逐步定制为一个新的 JS 运行时的。</p><p>本文将分上下两篇，逐一覆盖（或者说，用尽可能简单的代码实现）这些内容：</p><ul><li>集成嵌入式 JS 引擎</li><li>为 JS 引擎扩展原生能力</li><li>移植默认 Event Loop</li><li>支持 libuv Event Loop</li><li>支持宏任务与微任务</li></ul><p>上篇主要涉及前三节，主要介绍 QuickJS 这一嵌入式 JS 引擎自身的基本使用，并移植其自带的 Event Loop 示例。而下篇所对应的后两节中，我们将引入 libuv，讲解如何基于 libuv 实现扩展性更好的 Event Loop，并支持宏任务与微任务。</p><p>闲话少说，进入白学现场吧 :)</p><h2>集成嵌入式 JS 引擎</h2><p>在我的理解里，JS 引擎的「嵌入式」可以从两种层面来理解，一种意味着它面向低端的嵌入式设备，另一种则说明它很易于<b>嵌入到原生项目中</b>。而 JS 运行时 (Runtime) 其实也是一种原生项目，它将 JS 引擎作为专用的解释器，为其提供操作系统的网络、进程、文件系统等平台能力。因此，要想自己实现一个 JS 运行时，首先应该考虑的自然是「如何将 JS 引擎嵌入到原生项目中」了。</p><blockquote>本节内容是面向我这样前端背景（没有正经做过 C / C++ 项目）的同学的，熟悉的小伙伴可以跳过。 </blockquote><p>怎样才算将 JS 引擎嵌入了呢？我们知道，最简单的 C 程序就是个 main 函数。如果我们能在 main 函数里调用引擎执行一段 JS 代码，那不就成功「嵌入」了吗——就好像只要在地球两头各放一片面包，就能把地球做成三明治一样。</p><p>所以，又该怎样在自己写的 C 代码中调用引擎呢？从 C 开发者的视角看，JS 引擎也可以被当作一个第三方库来使用，它的集成方式和普通的第三方库并没有什么不同，简单说包括这几步：</p><ol><li>将引擎源码编译为库文件，这既可以是 <code>.a</code> 格式的静态库，也可以是 <code>.so</code> 或 <code>.dll</code> 格式的动态库。</li><li>在自己的 C 源码中 include 引擎的头文件，调用它提供的 API。</li><li>编译自己的 C 源码，并链接上引擎的库文件，生成最终的可执行文件。</li></ol><p>对 QuickJS 来说，只要一行 <code>make &amp;&amp; sudo make install</code> 就能完成编译和安装（再啰嗦一句，原生软件包的所谓安装，其实就是把头文件与编译出来的库文件、可执行文件，分别复制到符合 Unix 标准的目录下而已），然后就可以在我们的 C 源码里使用它了。</p><p>完成 QuickJS 的编译安装后，我们甚至不用亲自动手写 C，可以偷懒让 QuickJS 帮你生成，因为它支持把 JS 编译到 C 噢。像这样的一行 JS：</p><div class="highlight"><pre><code class="language-js"><span class="nx">console</span><span class="p">.</span><span class="nx">log</span><span class="p">(</span><span class="s2">&#34;Hello World&#34;</span><span class="p">);</span>
</code></pre></div><p>就可以用 <code>qjsc -e</code> 命令编译成这样的 C 源码：</p><div class="highlight"><pre><code class="language-c"><span class="cp">#include</span> <span class="cpf">&lt;quickjs/quickjs-libc.h&gt;</span><span class="cp">
</span><span class="cp"></span>
<span class="k">const</span> <span class="n">uint32_t</span> <span class="n">qjsc_hello_size</span> <span class="o">=</span> <span class="mi">87</span><span class="p">;</span>

<span class="k">const</span> <span class="n">uint8_t</span> <span class="n">qjsc_hello</span><span class="p">[</span><span class="mi">87</span><span class="p">]</span> <span class="o">=</span> <span class="p">{</span>
 <span class="mh">0x02</span><span class="p">,</span> <span class="mh">0x04</span><span class="p">,</span> <span class="mh">0x0e</span><span class="p">,</span> <span class="mh">0x63</span><span class="p">,</span> <span class="mh">0x6f</span><span class="p">,</span> <span class="mh">0x6e</span><span class="p">,</span> <span class="mh">0x73</span><span class="p">,</span> <span class="mh">0x6f</span><span class="p">,</span>
 <span class="mh">0x6c</span><span class="p">,</span> <span class="mh">0x65</span><span class="p">,</span> <span class="mh">0x06</span><span class="p">,</span> <span class="mh">0x6c</span><span class="p">,</span> <span class="mh">0x6f</span><span class="p">,</span> <span class="mh">0x67</span><span class="p">,</span> <span class="mh">0x16</span><span class="p">,</span> <span class="mh">0x48</span><span class="p">,</span>
 <span class="mh">0x65</span><span class="p">,</span> <span class="mh">0x6c</span><span class="p">,</span> <span class="mh">0x6c</span><span class="p">,</span> <span class="mh">0x6f</span><span class="p">,</span> <span class="mh">0x20</span><span class="p">,</span> <span class="mh">0x57</span><span class="p">,</span> <span class="mh">0x6f</span><span class="p">,</span> <span class="mh">0x72</span><span class="p">,</span>
 <span class="mh">0x6c</span><span class="p">,</span> <span class="mh">0x64</span><span class="p">,</span> <span class="mh">0x22</span><span class="p">,</span> <span class="mh">0x65</span><span class="p">,</span> <span class="mh">0x78</span><span class="p">,</span> <span class="mh">0x61</span><span class="p">,</span> <span class="mh">0x6d</span><span class="p">,</span> <span class="mh">0x70</span><span class="p">,</span>
 <span class="mh">0x6c</span><span class="p">,</span> <span class="mh">0x65</span><span class="p">,</span> <span class="mh">0x73</span><span class="p">,</span> <span class="mh">0x2f</span><span class="p">,</span> <span class="mh">0x68</span><span class="p">,</span> <span class="mh">0x65</span><span class="p">,</span> <span class="mh">0x6c</span><span class="p">,</span> <span class="mh">0x6c</span><span class="p">,</span>
 <span class="mh">0x6f</span><span class="p">,</span> <span class="mh">0x2e</span><span class="p">,</span> <span class="mh">0x6a</span><span class="p">,</span> <span class="mh">0x73</span><span class="p">,</span> <span class="mh">0x0e</span><span class="p">,</span> <span class="mh">0x00</span><span class="p">,</span> <span class="mh">0x06</span><span class="p">,</span> <span class="mh">0x00</span><span class="p">,</span>
 <span class="mh">0x9e</span><span class="p">,</span> <span class="mh">0x01</span><span class="p">,</span> <span class="mh">0x00</span><span class="p">,</span> <span class="mh">0x01</span><span class="p">,</span> <span class="mh">0x00</span><span class="p">,</span> <span class="mh">0x03</span><span class="p">,</span> <span class="mh">0x00</span><span class="p">,</span> <span class="mh">0x00</span><span class="p">,</span>
 <span class="mh">0x14</span><span class="p">,</span> <span class="mh">0x01</span><span class="p">,</span> <span class="mh">0xa0</span><span class="p">,</span> <span class="mh">0x01</span><span class="p">,</span> <span class="mh">0x00</span><span class="p">,</span> <span class="mh">0x00</span><span class="p">,</span> <span class="mh">0x00</span><span class="p">,</span> <span class="mh">0x39</span><span class="p">,</span>
 <span class="mh">0xf1</span><span class="p">,</span> <span class="mh">0x00</span><span class="p">,</span> <span class="mh">0x00</span><span class="p">,</span> <span class="mh">0x00</span><span class="p">,</span> <span class="mh">0x43</span><span class="p">,</span> <span class="mh">0xf2</span><span class="p">,</span> <span class="mh">0x00</span><span class="p">,</span> <span class="mh">0x00</span><span class="p">,</span>
 <span class="mh">0x00</span><span class="p">,</span> <span class="mh">0x04</span><span class="p">,</span> <span class="mh">0xf3</span><span class="p">,</span> <span class="mh">0x00</span><span class="p">,</span> <span class="mh">0x00</span><span class="p">,</span> <span class="mh">0x00</span><span class="p">,</span> <span class="mh">0x24</span><span class="p">,</span> <span class="mh">0x01</span><span class="p">,</span>
 <span class="mh">0x00</span><span class="p">,</span> <span class="mh">0xd1</span><span class="p">,</span> <span class="mh">0x28</span><span class="p">,</span> <span class="mh">0xe8</span><span class="p">,</span> <span class="mh">0x03</span><span class="p">,</span> <span class="mh">0x01</span><span class="p">,</span> <span class="mh">0x00</span><span class="p">,</span>
<span class="p">};</span>

<span class="kt">int</span> <span class="nf">main</span><span class="p">(</span><span class="kt">int</span> <span class="n">argc</span><span class="p">,</span> <span class="kt">char</span> <span class="o">**</span><span class="n">argv</span><span class="p">)</span>
<span class="p">{</span>
  <span class="n">JSRuntime</span> <span class="o">*</span><span class="n">rt</span><span class="p">;</span>
  <span class="n">JSContext</span> <span class="o">*</span><span class="n">ctx</span><span class="p">;</span>
  <span class="n">rt</span> <span class="o">=</span> <span class="n">JS_NewRuntime</span><span class="p">();</span>
  <span class="n">ctx</span> <span class="o">=</span> <span class="n">JS_NewContextRaw</span><span class="p">(</span><span class="n">rt</span><span class="p">);</span>
  <span class="n">JS_AddIntrinsicBaseObjects</span><span class="p">(</span><span class="n">ctx</span><span class="p">);</span>
  <span class="n">js_std_add_helpers</span><span class="p">(</span><span class="n">ctx</span><span class="p">,</span> <span class="n">argc</span><span class="p">,</span> <span class="n">argv</span><span class="p">);</span>
  <span class="n">js_std_eval_binary</span><span class="p">(</span><span class="n">ctx</span><span class="p">,</span> <span class="n">qjsc_hello</span><span class="p">,</span> <span class="n">qjsc_hello_size</span><span class="p">,</span> <span class="mi">0</span><span class="p">);</span>
  <span class="n">js_std_loop</span><span class="p">(</span><span class="n">ctx</span><span class="p">);</span>
  <span class="n">JS_FreeContext</span><span class="p">(</span><span class="n">ctx</span><span class="p">);</span>
  <span class="n">JS_FreeRuntime</span><span class="p">(</span><span class="n">rt</span><span class="p">);</span>
  <span class="k">return</span> <span class="mi">0</span><span class="p">;</span>
<span class="p">}</span></code></pre></div><p>这不就是我们要的 main 函数示例吗？这个 Hello World 已经变成了数组里的字节码，嵌入到最简单的 C 项目中了。</p><blockquote>注意这其实只是把 JS 编译成字节码，再附上个 main 胶水代码入口而已，不是真的把 JS 编译成 C 啦。</blockquote><p>当然，这份 C 源码还要再用 C 编译器编译一次才行。就像使用 Babel 和 Webpack 时的配置那样，原生工程也需要构建配置。对于构建工具，这里选择了现代工程中几乎标配的 <a href="https://link.zhihu.com/?target=https%3A//cmake.org/" class=" wrap external" target="_blank" rel="nofollow noreferrer">CMake</a>。和这份 C 源码相配套的 <code>CMakeLists.txt</code> 构建配置，则是这样的：</p><div class="highlight"><pre><code class="language-text">cmake_minimum_required(VERSION 3.10)
# 约定 runtime 为最终生成的可执行文件
project(runtime)
add_executable(runtime
        # 若拆分了多个 C 文件，逐行在此添加即可
        src/main.c)

# 导入 QuickJS 的头文件和库文件
include_directories(/usr/local/include)
add_library(quickjs STATIC IMPORTED)
set_target_properties(quickjs
        PROPERTIES IMPORTED_LOCATION
        &#34;/usr/local/lib/quickjs/libquickjs.a&#34;)

# 将 QuickJS 链接到 runtime
target_link_libraries(runtime
        quickjs)</code></pre></div><p>CMake 的使用很简单，在此不再赘述。总之，上面的配置能编译出 <code>runtime</code> 二进制文件，直接运行它能输出 Hello World，知道这些就够啦。</p><h2>为 JS 引擎扩展原生能力</h2><p>上一步走通后，我们其实已经将 JS 引擎套在了一个 C 程序的壳里了。然而，这只是个「纯净版」的引擎，也就意味着它并不支持语言标准之外，任何由平台提供的能力。像浏览器里的 <code>document.getElementById</code> 和 Node.js 里的 <code>fs.readFile</code>，就都属于这样的能力。因此，在实现更复杂的 Event Loop 之前，我们至少应该能在 JS 引擎里调用到自己写的 C 原生函数，就像浏览器控制台里司空见惯的这样：</p><div class="highlight"><pre><code class="language-text">&gt; document.getElementById
ƒ getElementById() { [native code] }</code></pre></div><p>所以，该怎样将 C 代码封装为这样的函数呢？和其它 JS 引擎一样地，QuickJS 提供了标准化的 API，方便你用 C 来实现 JS 中的函数和类。下面我们以计算斐波那契数的递归 fib 函数为例，演示如何将 JS 的计算密集型函数改由 C 实现，从而大幅提升性能。</p><p>JS 版的原始 fib 函数是这样的：</p><div class="highlight"><pre><code class="language-js"><span class="kd">function</span> <span class="nx">fib</span><span class="p">(</span><span class="nx">n</span><span class="p">)</span> <span class="p">{</span>
  <span class="k">if</span> <span class="p">(</span><span class="nx">n</span> <span class="o">&lt;=</span> <span class="mi">0</span><span class="p">)</span> <span class="k">return</span> <span class="mi">0</span><span class="p">;</span>
  <span class="k">else</span> <span class="k">if</span> <span class="p">(</span><span class="nx">n</span> <span class="o">===</span> <span class="mi">1</span><span class="p">)</span> <span class="k">return</span> <span class="mi">1</span><span class="p">;</span>
  <span class="k">else</span> <span class="k">return</span> <span class="nx">fib</span><span class="p">(</span><span class="nx">n</span> <span class="o">-</span> <span class="mi">1</span><span class="p">)</span> <span class="o">+</span> <span class="nx">fib</span><span class="p">(</span><span class="nx">n</span> <span class="o">-</span> <span class="mi">2</span><span class="p">);</span>
<span class="p">}</span>
</code></pre></div><p>而 C 版本的 fib 函数则是这样的，怎么看起来这么像呢？</p><div class="highlight"><pre><code class="language-c"><span class="kt">int</span> <span class="nf">fib</span><span class="p">(</span><span class="kt">int</span> <span class="n">n</span><span class="p">)</span> <span class="p">{</span>
  <span class="k">if</span> <span class="p">(</span><span class="n">n</span> <span class="o">&lt;=</span> <span class="mi">0</span><span class="p">)</span> <span class="k">return</span> <span class="mi">0</span><span class="p">;</span>
  <span class="k">else</span> <span class="k">if</span> <span class="p">(</span><span class="n">n</span> <span class="o">==</span> <span class="mi">1</span><span class="p">)</span> <span class="k">return</span> <span class="mi">1</span><span class="p">;</span>
  <span class="k">else</span> <span class="k">return</span> <span class="n">fib</span><span class="p">(</span><span class="n">n</span> <span class="o">-</span> <span class="mi">1</span><span class="p">)</span> <span class="o">+</span> <span class="n">fib</span><span class="p">(</span><span class="n">n</span> <span class="o">-</span> <span class="mi">2</span><span class="p">);</span>
<span class="p">}</span></code></pre></div><p>要想在 QuickJS 引擎中使用上面这个 C 函数，大致要做这么几件事：</p><ol><li>把 C 函数包一层，处理它与 JS 引擎之间的类型转换。</li><li>将包好的函数挂载到 JS 模块下。</li><li>将整个原生模块对外提供出来。</li></ol><p>这一共只要约 30 行胶水代码就够了，相应的 <code>fib.c</code> 源码如下所示：</p><div class="highlight"><pre><code class="language-c"><span class="cp">#include</span> <span class="cpf">&lt;quickjs/quickjs.h&gt;</span><span class="cp">
</span><span class="cp">#define countof(x) (sizeof(x) / sizeof((x)[0]))
</span><span class="cp"></span>
<span class="c1">// 原始的 C 函数
</span><span class="c1"></span><span class="k">static</span> <span class="kt">int</span> <span class="nf">fib</span><span class="p">(</span><span class="kt">int</span> <span class="n">n</span><span class="p">)</span> <span class="p">{</span>
    <span class="k">if</span> <span class="p">(</span><span class="n">n</span> <span class="o">&lt;=</span> <span class="mi">0</span><span class="p">)</span> <span class="k">return</span> <span class="mi">0</span><span class="p">;</span>
    <span class="k">else</span> <span class="k">if</span> <span class="p">(</span><span class="n">n</span> <span class="o">==</span> <span class="mi">1</span><span class="p">)</span> <span class="k">return</span> <span class="mi">1</span><span class="p">;</span>
    <span class="k">else</span> <span class="k">return</span> <span class="n">fib</span><span class="p">(</span><span class="n">n</span> <span class="o">-</span> <span class="mi">1</span><span class="p">)</span> <span class="o">+</span> <span class="n">fib</span><span class="p">(</span><span class="n">n</span> <span class="o">-</span> <span class="mi">2</span><span class="p">);</span>
<span class="p">}</span>

<span class="c1">// 包一层，处理类型转换
</span><span class="c1"></span><span class="k">static</span> <span class="n">JSValue</span> <span class="nf">js_fib</span><span class="p">(</span><span class="n">JSContext</span> <span class="o">*</span><span class="n">ctx</span><span class="p">,</span> <span class="n">JSValueConst</span> <span class="n">this_val</span><span class="p">,</span>
                      <span class="kt">int</span> <span class="n">argc</span><span class="p">,</span> <span class="n">JSValueConst</span> <span class="o">*</span><span class="n">argv</span><span class="p">)</span> <span class="p">{</span>
    <span class="kt">int</span> <span class="n">n</span><span class="p">,</span> <span class="n">res</span><span class="p">;</span>
    <span class="k">if</span> <span class="p">(</span><span class="n">JS_ToInt32</span><span class="p">(</span><span class="n">ctx</span><span class="p">,</span> <span class="o">&amp;</span><span class="n">n</span><span class="p">,</span> <span class="n">argv</span><span class="p">[</span><span class="mi">0</span><span class="p">]))</span> <span class="k">return</span> <span class="n">JS_EXCEPTION</span><span class="p">;</span>
    <span class="n">res</span> <span class="o">=</span> <span class="n">fib</span><span class="p">(</span><span class="n">n</span><span class="p">);</span>
    <span class="k">return</span> <span class="n">JS_NewInt32</span><span class="p">(</span><span class="n">ctx</span><span class="p">,</span> <span class="n">res</span><span class="p">);</span>
<span class="p">}</span>

<span class="c1">// 将包好的函数定义为 JS 模块下的 fib 方法
</span><span class="c1"></span><span class="k">static</span> <span class="k">const</span> <span class="n">JSCFunctionListEntry</span> <span class="n">js_fib_funcs</span><span class="p">[]</span> <span class="o">=</span> <span class="p">{</span>
    <span class="n">JS_CFUNC_DEF</span><span class="p">(</span><span class="s">&#34;fib&#34;</span><span class="p">,</span> <span class="mi">1</span><span class="p">,</span> <span class="n">js_fib</span> <span class="p">),</span>
<span class="p">};</span>

<span class="c1">// 模块初始化时的回调
</span><span class="c1"></span><span class="k">static</span> <span class="kt">int</span> <span class="nf">js_fib_init</span><span class="p">(</span><span class="n">JSContext</span> <span class="o">*</span><span class="n">ctx</span><span class="p">,</span> <span class="n">JSModuleDef</span> <span class="o">*</span><span class="n">m</span><span class="p">)</span> <span class="p">{</span>
    <span class="k">return</span> <span class="n">JS_SetModuleExportList</span><span class="p">(</span><span class="n">ctx</span><span class="p">,</span> <span class="n">m</span><span class="p">,</span> <span class="n">js_fib_funcs</span><span class="p">,</span> <span class="n">countof</span><span class="p">(</span><span class="n">js_fib_funcs</span><span class="p">));</span>
<span class="p">}</span>

<span class="c1">// 最终对外的 JS 模块定义
</span><span class="c1"></span><span class="n">JSModuleDef</span> <span class="o">*</span><span class="nf">js_init_module_fib</span><span class="p">(</span><span class="n">JSContext</span> <span class="o">*</span><span class="n">ctx</span><span class="p">,</span> <span class="k">const</span> <span class="kt">char</span> <span class="o">*</span><span class="n">module_name</span><span class="p">)</span> <span class="p">{</span>
    <span class="n">JSModuleDef</span> <span class="o">*</span><span class="n">m</span><span class="p">;</span>
    <span class="n">m</span> <span class="o">=</span> <span class="n">JS_NewCModule</span><span class="p">(</span><span class="n">ctx</span><span class="p">,</span> <span class="n">module_name</span><span class="p">,</span> <span class="n">js_fib_init</span><span class="p">);</span>
    <span class="k">if</span> <span class="p">(</span><span class="o">!</span><span class="n">m</span><span class="p">)</span> <span class="k">return</span> <span class="nb">NULL</span><span class="p">;</span>
    <span class="n">JS_AddModuleExportList</span><span class="p">(</span><span class="n">ctx</span><span class="p">,</span> <span class="n">m</span><span class="p">,</span> <span class="n">js_fib_funcs</span><span class="p">,</span> <span class="n">countof</span><span class="p">(</span><span class="n">js_fib_funcs</span><span class="p">));</span>
    <span class="k">return</span> <span class="n">m</span><span class="p">;</span>
<span class="p">}</span></code></pre></div><p>上面这个 <code>fib.c</code> 文件只要加入 <code>CMakeLists.txt</code> 中的 <code>add_executable</code> 项中，就可以被编译进来使用了。这样在原本的 <code>main.c</code> 入口里，只要在 eval JS 代码前多加两行初始化代码，就能准备好带有原生模块的 JS 引擎环境了：</p><div class="highlight"><pre><code class="language-c"><span class="c1">// ...
</span><span class="c1"></span><span class="kt">int</span> <span class="nf">main</span><span class="p">(</span><span class="kt">int</span> <span class="n">argc</span><span class="p">,</span> <span class="kt">char</span> <span class="o">**</span><span class="n">argv</span><span class="p">)</span>
<span class="p">{</span>
  <span class="c1">// ...
</span><span class="c1"></span>  <span class="c1">// 在 eval 前注册上名为 fib.so 的原生模块
</span><span class="c1"></span>  <span class="k">extern</span> <span class="n">JSModuleDef</span> <span class="o">*</span><span class="n">js_init_module_fib</span><span class="p">(</span><span class="n">JSContext</span> <span class="o">*</span><span class="n">ctx</span><span class="p">,</span> <span class="k">const</span> <span class="kt">char</span> <span class="o">*</span><span class="n">name</span><span class="p">);</span>
  <span class="n">js_init_module_fib</span><span class="p">(</span><span class="n">ctx</span><span class="p">,</span> <span class="s">&#34;fib.so&#34;</span><span class="p">);</span>

  <span class="c1">// eval JS 字节码
</span><span class="c1"></span>  <span class="n">js_std_eval_binary</span><span class="p">(</span><span class="n">ctx</span><span class="p">,</span> <span class="n">qjsc_hello</span><span class="p">,</span> <span class="n">qjsc_hello_size</span><span class="p">,</span> <span class="mi">0</span><span class="p">);</span>
  <span class="c1">// ...
</span><span class="c1"></span><span class="p">}</span></code></pre></div><p>这样，我们就能用这种方式在 JS 中使用 C 模块了：</p><div class="highlight"><pre><code class="language-js"><span class="kr">import</span> <span class="p">{</span> <span class="nx">fib</span> <span class="p">}</span> <span class="nx">from</span> <span class="s2">&#34;fib.so&#34;</span><span class="p">;</span>

<span class="nx">fib</span><span class="p">(</span><span class="mi">42</span><span class="p">);</span>
</code></pre></div><p>作为嵌入式 JS 引擎，QuickJS 的默认性能自然比不过带 JIT 的 V8。实测 QuickJS 里 <code>fib(42)</code>  需要约 30 秒，而 V8 只要约 3.5 秒。但一旦引入 C 原生模块，QuickJS 就能一举超越 V8，在不到 2 秒内完成计算，<b>轻松提速 15 倍</b>！</p><blockquote>可以发现，现代 JS 引擎对计算密集任务的 JIT 已经很强，因此如果将浏览器里的 JS 替换为 WASM，加速效果未必足够理想。详见我的这篇文章：<a href="https://zhuanlan.zhihu.com/p/102692865" class="internal">一个白学家眼里的 WebAssembly</a>。</blockquote><h2>移植默认 Event Loop</h2><p>到此为止，我们应该已经明白该如何嵌入 JS 引擎，并为其扩展 C 模块了。但是，上面的 <code>fib</code> 函数只是个同步函数，并不是异步的。各类支持回调的异步能力，是如何被运行时支持的呢？这就需要传说中的 Event Loop 了。</p><p>目前，前端社区中已有太多关于 Event Loop 的概念性介绍，可惜仍然鲜有人真正用简洁的代码给出可用的实现。好在 QuickJS 随引擎附带了个很好的例子，告诉大家如何化繁为简地从头实现自己的 Event Loop，这也就是本节所希望覆盖的内容了。</p><p>Event Loop 最简单的应用，可能就是 setTimeout 了。和语言规范一致地，QuickJS 默认并没有提供 setTimeout 这样需要运行时能力的异步 API 支持。但是，引擎编译时默认会内置 <code>std</code> 和 <code>os</code> 两个原生模块，可以这样使用 setTimeout 来支持异步：</p><div class="highlight"><pre><code class="language-js"><span class="kr">import</span> <span class="p">{</span> <span class="nx">setTimeout</span> <span class="p">}</span> <span class="nx">from</span> <span class="s2">&#34;os&#34;</span><span class="p">;</span>

<span class="nx">setTimeout</span><span class="p">(()</span> <span class="p">=&gt;</span> <span class="p">{</span> <span class="cm">/* ... */</span> <span class="p">},</span> <span class="mi">0</span><span class="p">);</span>
</code></pre></div><p>稍微检查下源码就能发现，这个 <code>os</code> 模块并不在 <code>quickjs.c</code> 引擎本体里，而是和前面的 <code>fib.c</code> 如出一辙地，通过标准化的 QuickJS API 挂载上去的原生模块。这个原生的 setTimeout 函数是怎么实现的呢？它的源码其实很少，像这样：</p><div class="highlight"><pre><code class="language-c"><span class="k">static</span> <span class="n">JSValue</span> <span class="nf">js_os_setTimeout</span><span class="p">(</span><span class="n">JSContext</span> <span class="o">*</span><span class="n">ctx</span><span class="p">,</span> <span class="n">JSValueConst</span> <span class="n">this_val</span><span class="p">,</span>
                                <span class="kt">int</span> <span class="n">argc</span><span class="p">,</span> <span class="n">JSValueConst</span> <span class="o">*</span><span class="n">argv</span><span class="p">)</span>
<span class="p">{</span>
    <span class="n">int64_t</span> <span class="n">delay</span><span class="p">;</span>
    <span class="n">JSValueConst</span> <span class="n">func</span><span class="p">;</span>
    <span class="n">JSOSTimer</span> <span class="o">*</span><span class="n">th</span><span class="p">;</span>
    <span class="n">JSValue</span> <span class="n">obj</span><span class="p">;</span>

    <span class="n">func</span> <span class="o">=</span> <span class="n">argv</span><span class="p">[</span><span class="mi">0</span><span class="p">];</span>
    <span class="k">if</span> <span class="p">(</span><span class="o">!</span><span class="n">JS_IsFunction</span><span class="p">(</span><span class="n">ctx</span><span class="p">,</span> <span class="n">func</span><span class="p">))</span>
        <span class="k">return</span> <span class="n">JS_ThrowTypeError</span><span class="p">(</span><span class="n">ctx</span><span class="p">,</span> <span class="s">&#34;not a function&#34;</span><span class="p">);</span>
    <span class="k">if</span> <span class="p">(</span><span class="n">JS_ToInt64</span><span class="p">(</span><span class="n">ctx</span><span class="p">,</span> <span class="o">&amp;</span><span class="n">delay</span><span class="p">,</span> <span class="n">argv</span><span class="p">[</span><span class="mi">1</span><span class="p">]))</span>
        <span class="k">return</span> <span class="n">JS_EXCEPTION</span><span class="p">;</span>
    <span class="n">obj</span> <span class="o">=</span> <span class="n">JS_NewObjectClass</span><span class="p">(</span><span class="n">ctx</span><span class="p">,</span> <span class="n">js_os_timer_class_id</span><span class="p">);</span>
    <span class="k">if</span> <span class="p">(</span><span class="n">JS_IsException</span><span class="p">(</span><span class="n">obj</span><span class="p">))</span>
        <span class="k">return</span> <span class="n">obj</span><span class="p">;</span>
    <span class="n">th</span> <span class="o">=</span> <span class="n">js_mallocz</span><span class="p">(</span><span class="n">ctx</span><span class="p">,</span> <span class="k">sizeof</span><span class="p">(</span><span class="o">*</span><span class="n">th</span><span class="p">));</span>
    <span class="k">if</span> <span class="p">(</span><span class="o">!</span><span class="n">th</span><span class="p">)</span> <span class="p">{</span>
        <span class="n">JS_FreeValue</span><span class="p">(</span><span class="n">ctx</span><span class="p">,</span> <span class="n">obj</span><span class="p">);</span>
        <span class="k">return</span> <span class="n">JS_EXCEPTION</span><span class="p">;</span>
    <span class="p">}</span>
    <span class="n">th</span><span class="o">-&gt;</span><span class="n">has_object</span> <span class="o">=</span> <span class="n">TRUE</span><span class="p">;</span>
    <span class="n">th</span><span class="o">-&gt;</span><span class="n">timeout</span> <span class="o">=</span> <span class="n">get_time_ms</span><span class="p">()</span> <span class="o">+</span> <span class="n">delay</span><span class="p">;</span>
    <span class="n">th</span><span class="o">-&gt;</span><span class="n">func</span> <span class="o">=</span> <span class="n">JS_DupValue</span><span class="p">(</span><span class="n">ctx</span><span class="p">,</span> <span class="n">func</span><span class="p">);</span>
    <span class="n">list_add_tail</span><span class="p">(</span><span class="o">&amp;</span><span class="n">th</span><span class="o">-&gt;</span><span class="n">link</span><span class="p">,</span> <span class="o">&amp;</span><span class="n">os_timers</span><span class="p">);</span>
    <span class="n">JS_SetOpaque</span><span class="p">(</span><span class="n">obj</span><span class="p">,</span> <span class="n">th</span><span class="p">);</span>
    <span class="k">return</span> <span class="n">obj</span><span class="p">;</span>
<span class="p">}</span></code></pre></div><p>可以看出，这个 setTimeout 的实现中，并没有任何多线程或 poll 的操作，只是把一个存储 timer 信息的结构体通过 <code>JS_SetOpaque</code> 的方式，挂到了最后返回的 JS 对象上而已，是个非常简单的同步操作。因此，就和调用原生 fib 函数一样地，<b>在 eval 执行 JS 代码时，遇到 setTimeout 后也是同步地执行一点 C 代码后就立刻返回，没有什么特别之处</b>。</p><p>但为什么 setTimeout 能实现异步呢？关键在于 eval 之后，我们就要启动 Event Loop 了。而这里的奥妙其实也在 QuickJS 编译器生成的代码里明确地写出来了，没想到吧：</p><div class="highlight"><pre><code class="language-c"><span class="c1">// ...
</span><span class="c1"></span><span class="kt">int</span> <span class="nf">main</span><span class="p">(</span><span class="kt">int</span> <span class="n">argc</span><span class="p">,</span> <span class="kt">char</span> <span class="o">**</span><span class="n">argv</span><span class="p">)</span>
<span class="p">{</span>
  <span class="c1">// ...
</span><span class="c1"></span>  <span class="c1">// eval JS 字节码
</span><span class="c1"></span>  <span class="n">js_std_eval_binary</span><span class="p">(</span><span class="n">ctx</span><span class="p">,</span> <span class="n">qjsc_hello</span><span class="p">,</span> <span class="n">qjsc_hello_size</span><span class="p">,</span> <span class="mi">0</span><span class="p">);</span>
  <span class="c1">// 启动 Event Loop
</span><span class="c1"></span>  <span class="n">js_std_loop</span><span class="p">(</span><span class="n">ctx</span><span class="p">);</span>
  <span class="c1">// ...
</span><span class="c1"></span><span class="p">}</span></code></pre></div><p>因此，eval 后的这个 <code>js_std_loop</code> 就是真正的 Event Loop，而它的源码则更是简单得像是伪代码一样：</p><div class="highlight"><pre><code class="language-c"><span class="cm">/* main loop which calls the user JS callbacks */</span>
<span class="kt">void</span> <span class="nf">js_std_loop</span><span class="p">(</span><span class="n">JSContext</span> <span class="o">*</span><span class="n">ctx</span><span class="p">)</span>
<span class="p">{</span>
    <span class="n">JSContext</span> <span class="o">*</span><span class="n">ctx1</span><span class="p">;</span>
    <span class="kt">int</span> <span class="n">err</span><span class="p">;</span>

    <span class="k">for</span><span class="p">(;;)</span> <span class="p">{</span>
        <span class="cm">/* execute the pending jobs */</span>
        <span class="k">for</span><span class="p">(;;)</span> <span class="p">{</span>
            <span class="n">err</span> <span class="o">=</span> <span class="n">JS_ExecutePendingJob</span><span class="p">(</span><span class="n">JS_GetRuntime</span><span class="p">(</span><span class="n">ctx</span><span class="p">),</span> <span class="o">&amp;</span><span class="n">ctx1</span><span class="p">);</span>
            <span class="k">if</span> <span class="p">(</span><span class="n">err</span> <span class="o">&lt;=</span> <span class="mi">0</span><span class="p">)</span> <span class="p">{</span>
                <span class="k">if</span> <span class="p">(</span><span class="n">err</span> <span class="o">&lt;</span> <span class="mi">0</span><span class="p">)</span> <span class="p">{</span>
                    <span class="n">js_std_dump_error</span><span class="p">(</span><span class="n">ctx1</span><span class="p">);</span>
                <span class="p">}</span>
                <span class="k">break</span><span class="p">;</span>
            <span class="p">}</span>
        <span class="p">}</span>

        <span class="k">if</span> <span class="p">(</span><span class="o">!</span><span class="n">os_poll_func</span> <span class="o">||</span> <span class="n">os_poll_func</span><span class="p">(</span><span class="n">ctx</span><span class="p">))</span>
            <span class="k">break</span><span class="p">;</span>
    <span class="p">}</span>
<span class="p">}</span></code></pre></div><p>这不就是在双重的死循环里先执行掉所有的 Job，然后调 <code>os_poll_func</code> 吗？可是，for 循环不会吃满 CPU 吗？这是个前端同学们容易误解的地方：<b>在原生开发中，进程里即便写着个死循环，也未必始终在前台运行，可以通过系统调用将自己挂起</b>。</p><p>例如，一个在死循环里通过 sleep 系统调用不停休眠一秒的进程，就只会每秒被系统执行一个 tick，其它时间里都不占资源。而这里的 <code>os_poll_func</code> 封装的，就是原理类似的 poll 系统调用（准确地说，用的其实是 select），从而可以借助操作系统的能力，使得只在【定时器触发、文件描述符读写】等事件发生时，让进程回到前台执行一个 tick，把此时应该运行的 JS 回调跑一遍，而其余时间都在后台挂起。在这条路上继续走下去，就能以经典的异步非阻塞方式来实现整个运行时啦。</p><blockquote>poll 和 select 想实现的东西是一致的，只是原理不同，前者性能更好而后者更简单而已。</blockquote><p>鉴于 <code>os_poll_func</code> 的代码较长，这里只概括下它与 timer 相关的工作：</p><ul><li>如果上下文中存在 timer，将到期 timer 对应的回调都执行掉。</li><li>找到所有 timer 中最小的时延，用 select 系统调用将自己挂起这段时间。</li></ul><p>这样，setTimeout 的流程就说得通了：<b>先在 eval 阶段简单设置一个 timer 结构，然后在 Event Loop 里用这个 timer 的参数去调用操作系统的 poll，从而在被唤醒的下一个 tick 里把到期 timer 对应的 JS 回调执行掉就行</b>。</p><p>所以，看明白这个 Event Loop 的机制后，就不难发现如果只关心 setTimeout 这个运行时 API，那么照抄，啊不移植的方法其实并不复杂：</p><ul><li>将 <code>os</code> 原生模块里的 setTimeout 相关部分，仿照 fib 的形式抄进来。</li><li>将 <code>js_std_loop</code> 及其依赖抄进来。</li></ul><p>这其实就是件按部就班就能完成的事，实际代码示例会和下篇一起给出。</p><p>到现在为止这些对 QuickJS 的分析，是否能让大家发现，许多经常听到的高大上概念，实现起来其实也没有那么复杂呢？别忘了，QuickJS 出自传奇程序员 Fabrice Bellard。读他代码的感受，就像读高中习题的参考答案一样，既不漏过每个关键的知识点又毫不拖泥带水，非常有启发性。他本人也像金庸小说里创造「天下武学正宗」的中神通王重阳那样，十分令人叹服。带着问题阅读更高段位的代码，也几乎总能带来丰富的收获。</p><p>好了，这就是上篇的全部内容了。在接下来的下篇中，我们将在熟悉了 QuickJS 和 Event Loop 的基础上，将 Event Loop 改由更可扩展的 libuv 来实现，届时全文涉及的代码示例也将一并给出。如果感兴趣，敬请关注我的这个「<a href="https://zhuanlan.zhihu.com/fe-fantasy" class="internal">前端随想录</a>」专栏噢～</p><blockquote>Update - 全文已完成写作，请移步这里阅读《<a href="https://zhuanlan.zhihu.com/p/104501929" class="internal">从 JS 引擎到 JS 运行时（下）</a>》</blockquote>