<p>在<a href="https://zhuanlan.zhihu.com/p/104333176" class="internal">上篇文章</a>中，我们已经为 JS 引擎扩展出了个最简单的 Event Loop。但像这样直接基于各操作系统不尽相同的 API 自己实现运行时，无疑是件苦差。有没有什么更好的玩法呢？是时候让 libuv 粉墨登场啦。</p><p>我们知道，<a href="http://link.zhihu.com/?target=https%3A//libuv.org/" class=" wrap external" target="_blank" rel="nofollow noreferrer">libuv</a> 是 Node.js 开发过程中衍生的异步 IO 库，能让 Event Loop 高性能地运行在不同平台上。可以说，今天的 Node.js 就相当于由 V8 和 libuv 拼接成的运行时。但 libuv 同样具备高度的通用性，已被用于实现 Lua、Julia 等其它语言的异步非阻塞运行时。接下来，我们将介绍如何用同样简单的代码，做到这两件事：</p><ul><li>将 Event Loop 切换到基于 libuv 实现</li><li>支持宏任务与微任务</li></ul><p>到本文结尾，我们就能把 QuickJS 引擎与 libuv 相结合，实现出一个代码更简单，但也更贴近实际使用的（玩具级）JS 运行时了。</p><h2>支持 libuv Event Loop</h2><p>在尝试将 JS 引擎与 libuv 相结合之前，我们至少需要先熟悉 libuv 的基础使用。同样地，它也是个第三方库，遵循上篇文章中提到过的使用方式：</p><ol><li>将 libuv 源码编译为库文件。</li><li>在项目中 include 相应头文件，使用 libuv。</li><li>编译项目，链接上 libuv 库文件，生成可执行文件。</li></ol><p>如何编译 libuv 不必在此赘述，但实际使用它的代码长什么样呢？下面是个简单的例子，简单几行就用 libuv 实现了个 setInterval 式的定时器：</p><div class="highlight"><pre><code class="language-c"><span></span><span class="cp">#include</span> <span class="cpf">&lt;stdio.h&gt;</span><span class="cp"></span>
<span class="cp">#include</span> <span class="cpf">&lt;uv.h&gt; // 这里假定 libuv 已经全局安装好</span><span class="cp"></span>

<span class="k">static</span> <span class="kt">void</span> <span class="nf">onTimerTick</span><span class="p">(</span><span class="n">uv_timer_t</span> <span class="o">*</span><span class="n">handle</span><span class="p">)</span> <span class="p">{</span>
  <span class="n">printf</span><span class="p">(</span><span class="s">"timer tick</span><span class="se">\n</span><span class="s">"</span><span class="p">);</span>
<span class="p">}</span>

<span class="kt">int</span> <span class="nf">main</span><span class="p">(</span><span class="kt">int</span> <span class="n">argc</span><span class="p">,</span> <span class="kt">char</span> <span class="o">**</span><span class="n">argv</span><span class="p">)</span> <span class="p">{</span>
    <span class="n">uv_loop_t</span> <span class="o">*</span><span class="n">loop</span> <span class="o">=</span> <span class="n">uv_default_loop</span><span class="p">();</span>
    <span class="n">uv_timer_t</span> <span class="n">timerHandle</span><span class="p">;</span>
    <span class="n">uv_timer_init</span><span class="p">(</span><span class="n">loop</span><span class="p">,</span> <span class="o">&amp;</span><span class="n">timerHandle</span><span class="p">);</span>
    <span class="n">uv_timer_start</span><span class="p">(</span><span class="o">&amp;</span><span class="n">timerHandle</span><span class="p">,</span> <span class="n">onTimerTick</span><span class="p">,</span> <span class="mi">0</span><span class="p">,</span> <span class="mi">1000</span><span class="p">);</span>
    <span class="n">uv_run</span><span class="p">(</span><span class="n">loop</span><span class="p">,</span> <span class="n">UV_RUN_DEFAULT</span><span class="p">);</span>
    <span class="k">return</span> <span class="mi">0</span><span class="p">;</span>
<span class="p">}</span>
</code></pre></div><p>为了让这份代码能正确编译，我们需要修改 CMake 配置，把 libuv 依赖加进来。完整的 <code>CMakeLists.txt</code> 构建配置如下所示，其实也就是照猫画虎而已：</p><div class="highlight"><pre><code class="language-text"><span></span>cmake_minimum_required(VERSION 3.10)
project(runtime)
add_executable(runtime
        src/main.c)

# quickjs
include_directories(/usr/local/include)
add_library(quickjs STATIC IMPORTED)
set_target_properties(quickjs
        PROPERTIES IMPORTED_LOCATION
        "/usr/local/lib/quickjs/libquickjs.a")

# libuv
add_library(libuv STATIC IMPORTED)
set_target_properties(libuv
        PROPERTIES IMPORTED_LOCATION
        "/usr/local/lib/libuv.a")

target_link_libraries(runtime
        libuv
        quickjs)
</code></pre></div><p>这样，<code>quickjs.h</code> 和 <code>uv.h</code> 就都可以 include 进来使用了。那么，该如何进一步地将上面的 libuv 定时器封装给 JS 引擎使用呢？我们需要先熟悉一下刚才的代码里涉及到的 libuv 基本概念：</p><ul><li><b>Callback</b> - 事件发生时所触发的回调，例如这里的 onTimerTick 函数。别忘了 C 里也支持将函数作为参数传递噢。</li><li><b>Handle</b> - 长时间存在，可以为其注册回调的对象，例如这里 <code>uv_timer_t</code> 类型的定时器。</li><li><b>Loop</b> - 封装了下层异步 IO 差异，可以为其添加 Handle 的 Event Loop，例如这里 <code>uv_loop_t</code> 类型的 loop 变量。</li></ul><p>所以简单说，libuv 的基本使用方式就相当于：<b>把 Callback 绑到 Handle 上，把 Handle 绑到 Loop 上，最后启动 Loop</b>。当然 libuv 里还有 Request 等重要概念，但这里暂时用不到，就不离题了。</p><p>明白这一背景后，上面的示例代码就显得很清晰了：</p><div class="highlight"><pre><code class="language-c"><span></span><span class="c1">// ...</span>
<span class="kt">int</span> <span class="nf">main</span><span class="p">(</span><span class="kt">int</span> <span class="n">argc</span><span class="p">,</span> <span class="kt">char</span> <span class="o">**</span><span class="n">argv</span><span class="p">)</span> <span class="p">{</span>
    <span class="c1">// 建立 loop 对象</span>
    <span class="n">uv_loop_t</span> <span class="o">*</span><span class="n">loop</span> <span class="o">=</span> <span class="n">uv_default_loop</span><span class="p">();</span>

    <span class="c1">// 把 handle 绑到 loop 上</span>
    <span class="n">uv_timer_t</span> <span class="n">timerHandle</span><span class="p">;</span>
    <span class="n">uv_timer_init</span><span class="p">(</span><span class="n">loop</span><span class="p">,</span> <span class="o">&amp;</span><span class="n">timerHandle</span><span class="p">);</span>

    <span class="c1">// 把 callback 绑到 handle 上，并启动 timer</span>
    <span class="n">uv_timer_start</span><span class="p">(</span><span class="o">&amp;</span><span class="n">timerHandle</span><span class="p">,</span> <span class="n">onTimerTick</span><span class="p">,</span> <span class="mi">0</span><span class="p">,</span> <span class="mi">1000</span><span class="p">);</span>

    <span class="c1">// 启动 event loop</span>
    <span class="n">uv_run</span><span class="p">(</span><span class="n">loop</span><span class="p">,</span> <span class="n">UV_RUN_DEFAULT</span><span class="p">);</span>
    <span class="k">return</span> <span class="mi">0</span><span class="p">;</span>
<span class="p">}</span>
</code></pre></div><p>这里最后的 <code>uv_run</code> 就像上篇中的 <code>js_std_loop</code> 那样，内部就是个可以「长时间把自己挂起」的死循环。在进入这个函数前，其它对 libuv API 的调用都是非常轻量而同步返回的。那我们自然可以这么设想：<b>只要我们能在上篇的代码中按同样的顺序依次调用 libuv，最后改为启动 libuv 的 Event Loop，那就能让 libuv 来接管运行时的下层实现了</b>。</p><p>更具体地说，实际的实现方式是这样的：</p><ul><li>在挂载原生模块前，初始化好 libuv 的 Loop 对象。</li><li>在初始的 JS 引擎 eval 过程中，每调用到一次 setTimeout，就初始化一个定时器的 Handle 并启动它。</li><li>待首次 eval 结束后，启动 libuv 的 Event Loop，让 libuv 在相应时机触发 C 回调，进而执行掉 JS 中的回调。</li></ul><p>这里需要额外提供的就是定时器的 C 回调了，它负责在相应的时机把 JS 引擎上下文里到期的回调执行掉。在上篇的实现中，这是在 <code>js_std_loop</code> 中硬编码的逻辑，并不易于扩展。为此我们实现的新函数如下所示，其核心就是一行调用函数对象的 <code>JS_Call</code>。但在此之外，我们还需要配合 <code>JS_FreeValue</code> 来管理对象的引用计数，否则会出现内存泄漏：</p><div class="highlight"><pre><code class="language-c"><span></span><span class="k">static</span> <span class="kt">void</span> <span class="nf">timerCallback</span><span class="p">(</span><span class="n">uv_timer_t</span> <span class="o">*</span><span class="n">handle</span><span class="p">)</span> <span class="p">{</span>
    <span class="c1">// libuv 支持在 handle 上挂任意的 data</span>
    <span class="n">MyTimerHandle</span> <span class="o">*</span><span class="n">th</span> <span class="o">=</span> <span class="n">handle</span><span class="o">-&gt;</span><span class="n">data</span><span class="p">;</span>
    <span class="c1">// 从 handle 上拿到引擎 context</span>
    <span class="n">JSContext</span> <span class="o">*</span><span class="n">ctx</span> <span class="o">=</span> <span class="n">th</span><span class="o">-&gt;</span><span class="n">ctx</span><span class="p">;</span>
    <span class="n">JSValue</span> <span class="n">ret</span><span class="p">;</span>

    <span class="c1">// 调用回调，这里的 th-&gt;func 在 setTimeout 时已准备好</span>
    <span class="n">ret</span> <span class="o">=</span> <span class="n">JS_Call</span><span class="p">(</span><span class="n">ctx</span><span class="p">,</span> <span class="n">th</span><span class="o">-&gt;</span><span class="n">func</span><span class="p">,</span> <span class="n">JS_UNDEFINED</span><span class="p">,</span> <span class="n">th</span><span class="o">-&gt;</span><span class="n">argc</span><span class="p">,</span> <span class="p">(</span><span class="n">JSValueConst</span> <span class="o">*</span><span class="p">)</span> <span class="n">th</span><span class="o">-&gt;</span><span class="n">argv</span><span class="p">);</span>

    <span class="c1">// 销毁掉回调函数及其返回值</span>
    <span class="n">JS_FreeValue</span><span class="p">(</span><span class="n">ctx</span><span class="p">,</span> <span class="n">ret</span><span class="p">);</span>
    <span class="n">JS_FreeValue</span><span class="p">(</span><span class="n">ctx</span><span class="p">,</span> <span class="n">th</span><span class="o">-&gt;</span><span class="n">func</span><span class="p">);</span>
    <span class="n">th</span><span class="o">-&gt;</span><span class="n">func</span> <span class="o">=</span> <span class="n">JS_UNDEFINED</span><span class="p">;</span>

    <span class="c1">// 销毁掉函数参数</span>
    <span class="k">for</span> <span class="p">(</span><span class="kt">int</span> <span class="n">i</span> <span class="o">=</span> <span class="mi">0</span><span class="p">;</span> <span class="n">i</span> <span class="o">&lt;</span> <span class="n">th</span><span class="o">-&gt;</span><span class="n">argc</span><span class="p">;</span> <span class="n">i</span><span class="o">++</span><span class="p">)</span> <span class="p">{</span>
        <span class="n">JS_FreeValue</span><span class="p">(</span><span class="n">ctx</span><span class="p">,</span> <span class="n">th</span><span class="o">-&gt;</span><span class="n">argv</span><span class="p">[</span><span class="n">i</span><span class="p">]);</span>
        <span class="n">th</span><span class="o">-&gt;</span><span class="n">argv</span><span class="p">[</span><span class="n">i</span><span class="p">]</span> <span class="o">=</span> <span class="n">JS_UNDEFINED</span><span class="p">;</span>
    <span class="p">}</span>
    <span class="n">th</span><span class="o">-&gt;</span><span class="n">argc</span> <span class="o">=</span> <span class="mi">0</span><span class="p">;</span>

    <span class="c1">// 销毁掉 setTimeout 返回的 timer</span>
    <span class="n">JSValue</span> <span class="n">obj</span> <span class="o">=</span> <span class="n">th</span><span class="o">-&gt;</span><span class="n">obj</span><span class="p">;</span>
    <span class="n">th</span><span class="o">-&gt;</span><span class="n">obj</span> <span class="o">=</span> <span class="n">JS_UNDEFINED</span><span class="p">;</span>
    <span class="n">JS_FreeValue</span><span class="p">(</span><span class="n">ctx</span><span class="p">,</span> <span class="n">obj</span><span class="p">);</span>
<span class="p">}</span>
</code></pre></div><p>这样就行了！这就是当 setTimeout 在 Event Loop 里触发时，libuv 回调内所应该执行的 JS 引擎操作了。</p><p>相应地，在 <code>js_uv_setTimeout</code> 中，需要依次调用 <code>uv_timer_init</code> 和 <code>uv_timer_start</code>，这样只要 eval 后在 <code>uv_run</code> 启动 Event Loop，整个流程就能串起来了。这部分代码只需在之前基础上做点小改，就不赘述了。</p><p>一个锦上添花的小技巧是往 JS 里再加点 polyfill，这样就可以保证 setTimeout 像浏览器和 Node.js 之中那样挂载到全局了：</p><div class="highlight"><pre><code class="language-js"><span></span><span class="kr">import</span> <span class="o">*</span> <span class="nx">as</span> <span class="nx">uv</span> <span class="nx">from</span> <span class="s2">"uv"</span><span class="p">;</span> <span class="c1">// 都基于 libuv 了，换个名字呗</span>

<span class="nx">globalThis</span><span class="p">.</span><span class="nx">setTimeout</span> <span class="o">=</span> <span class="nx">uv</span><span class="p">.</span><span class="nx">setTimeout</span><span class="p">;</span>
</code></pre></div><p>到这里，<b>setTimeout 就能基于 libuv 的 Event Loop 跑起来啦</b>。</p><h2>支持宏任务与微任务</h2><p>有经验的前端同学们都知道，setTimeout 并不是唯一的异步来源。比如大名鼎鼎的 Promise 也可以实现类似的效果：</p><div class="highlight"><pre><code class="language-js"><span></span><span class="c1">// 日志顺序是 A B</span>
<span class="nb">Promise</span><span class="p">.</span><span class="nx">resolve</span><span class="p">().</span><span class="nx">then</span><span class="p">(()</span> <span class="p">=&gt;</span> <span class="p">{</span>
  <span class="nx">console</span><span class="p">.</span><span class="nx">log</span><span class="p">(</span><span class="s1">'B'</span><span class="p">)</span>
<span class="p">})</span>
<span class="nx">console</span><span class="p">.</span><span class="nx">log</span><span class="p">(</span><span class="s1">'A'</span><span class="p">)</span>
</code></pre></div><p>但是，如果基于上一步中我们实现的运行时来执行这段代码，<b>你会发现只输出了 A，而 Promise 中的回调消失了</b>。这是怎么回事呢？</p><p>根据 <a href="http://link.zhihu.com/?target=https%3A//html.spec.whatwg.org/multipage/webappapis.html%23task-queue" class=" wrap external" target="_blank" rel="nofollow noreferrer">WHATWG 规范</a>，<b>标准 Event Loop 里的每个 Tick，都只会执行一个形如 setTimeout 这样的 Task 任务</b>。但在 Task 的执行过程中，也可能遇到多个「既需要异步，但又不需要被挪到下一个 Tick 执行」的工作，其典型就是 Promise。这些工作被称为 Microtask 微任务，都应该在这个 Tick 中执行掉。相应地，每个 Tick 所对应的唯一 Task，也被叫做 Macrotask 宏任务，这也就是宏任务和微任务概念的由来了。</p><blockquote>前有 Framebuffer 不是 Buffer，后有 Microtask 不是 Task，刺激不？</blockquote><p>所以，Promise 的异步执行属于微任务，需要在某个 Tick 内 eval 了一段 JS 后立刻执行。但现在的实现中，我们并没有在 libuv 的单个 Tick 内调用 JS 引擎执行掉这些微任务，这也就是 Promise 回调消失的原因了。</p><p>明白原因后，我们不难找到问题的解法：<b>只要我们能在每个 Tick 的收尾阶段执行一个固定的回调，那就能在此把微任务队列清空了</b>。在 libuv 中，也确实可以在每次 Tick 的不同阶段注册不同的 Handle 来触发回调，如下所示：</p><div class="highlight"><pre><code class="language-text"><span></span>   ┌───────────────────────────┐
┌─&gt;│           timers          │
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │     pending callbacks     │
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │       idle, prepare       │
│  └─────────────┬─────────────┘      ┌───────────────┐
│  ┌─────────────┴─────────────┐      │   incoming:   │
│  │           poll            │&lt;─────┤  connections, │
│  └─────────────┬─────────────┘      │   data, etc.  │
│  ┌─────────────┴─────────────┐      └───────────────┘
│  │           check           │
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
└──┤      close callbacks      │
   └───────────────────────────┘
</code></pre></div><p>上图中的 poll 阶段，就是实际调用 JS 引擎 eval 执行各类 JS 回调的阶段。在此阶段后的 check 阶段，就可以用来把刚才的 eval 所留下的微任务全部执行掉了。如何在每次 Tick 的 check 阶段都执行一个固定的回调呢？这倒也很简单，为 Loop 添加一个 <code>uv_check_t</code> 类型的 Handle 即可：</p><div class="highlight"><pre><code class="language-c"><span></span><span class="c1">// ...</span>
<span class="kt">int</span> <span class="nf">main</span><span class="p">(</span><span class="kt">int</span> <span class="n">argc</span><span class="p">,</span> <span class="kt">char</span> <span class="o">**</span><span class="n">argv</span><span class="p">)</span> <span class="p">{</span>
    <span class="c1">// 建立 loop 对象</span>
    <span class="n">uv_loop_t</span> <span class="o">*</span><span class="n">loop</span> <span class="o">=</span> <span class="n">uv_default_loop</span><span class="p">();</span>

    <span class="c1">// 把 handle 绑到 loop 上</span>
    <span class="n">uv_check_t</span> <span class="o">*</span><span class="n">check</span> <span class="o">=</span> <span class="n">calloc</span><span class="p">(</span><span class="mi">1</span><span class="p">,</span> <span class="k">sizeof</span><span class="p">(</span><span class="o">*</span><span class="n">check</span><span class="p">));</span>
    <span class="n">uv_check_init</span><span class="p">(</span><span class="n">loop</span><span class="p">,</span> <span class="n">check</span><span class="p">);</span>

    <span class="c1">// 把 callback 绑到 handle 上，并启用它</span>
    <span class="n">uv_check_start</span><span class="p">(</span><span class="n">check</span><span class="p">,</span> <span class="n">checkCallback</span><span class="p">);</span>

    <span class="c1">// 启动 event loop</span>
    <span class="n">uv_run</span><span class="p">(</span><span class="n">loop</span><span class="p">,</span> <span class="n">UV_RUN_DEFAULT</span><span class="p">);</span>
    <span class="k">return</span> <span class="mi">0</span><span class="p">;</span>
<span class="p">}</span>
</code></pre></div><p>这样，就可以在每次 poll 结束后执行 checkCallback 了。这个 C 的 callback 会负责清空 JS 引擎中的微任务，像这样：</p><div class="highlight"><pre><code class="language-c"><span></span><span class="kt">void</span> <span class="nf">checkCallback</span><span class="p">(</span><span class="n">uv_check_t</span> <span class="o">*</span><span class="n">handle</span><span class="p">)</span> <span class="p">{</span>
    <span class="n">JSContext</span> <span class="o">*</span><span class="n">ctx</span> <span class="o">=</span> <span class="n">handle</span><span class="o">-&gt;</span><span class="n">data</span><span class="p">;</span>
    <span class="n">JSContext</span> <span class="o">*</span><span class="n">ctx1</span><span class="p">;</span>
    <span class="kt">int</span> <span class="n">err</span><span class="p">;</span>

    <span class="c1">// 执行微任务，直到微任务队列清空</span>
    <span class="k">for</span> <span class="p">(;;)</span> <span class="p">{</span>
        <span class="n">err</span> <span class="o">=</span> <span class="n">JS_ExecutePendingJob</span><span class="p">(</span><span class="n">JS_GetRuntime</span><span class="p">(</span><span class="n">ctx</span><span class="p">),</span> <span class="o">&amp;</span><span class="n">ctx1</span><span class="p">);</span>
        <span class="k">if</span> <span class="p">(</span><span class="n">err</span> <span class="o">&lt;=</span> <span class="mi">0</span><span class="p">)</span> <span class="p">{</span>
            <span class="k">if</span> <span class="p">(</span><span class="n">err</span> <span class="o">&lt;</span> <span class="mi">0</span><span class="p">)</span>
                <span class="n">js_std_dump_error</span><span class="p">(</span><span class="n">ctx1</span><span class="p">);</span>
            <span class="k">break</span><span class="p">;</span>
        <span class="p">}</span>
    <span class="p">}</span>
<span class="p">}</span>
</code></pre></div><p>这样，Promise 的回调就可以顺利执行了！看起来，现在我们不就已经顺利实现了支持宏任务和微任务的 Event Loop 了吗？还差最后一步，考虑下面的这段 JS 代码：</p><div class="highlight"><pre><code class="language-js"><span></span><span class="nx">setTimeout</span><span class="p">(()</span> <span class="p">=&gt;</span> <span class="nx">console</span><span class="p">.</span><span class="nx">log</span><span class="p">(</span><span class="s1">'B'</span><span class="p">),</span> <span class="mi">0</span><span class="p">)</span>

<span class="nb">Promise</span><span class="p">.</span><span class="nx">resolve</span><span class="p">().</span><span class="nx">then</span><span class="p">(()</span> <span class="p">=&gt;</span> <span class="nx">console</span><span class="p">.</span><span class="nx">log</span><span class="p">(</span><span class="s1">'A'</span><span class="p">))</span>
</code></pre></div><p>作为面试题，大家应该都知道 setTimeout 的宏任务应该会在下一个 Tick 执行，而 Promise 的微任务应该在本次 Tick 末尾就执行掉，这样的执行顺序就是 <code>A B</code>。但基于现在的 check 回调实现，你会发现日志顺序颠倒过来了，这显然是不符合规范的。为什么会这样呢？</p><p>这并不是只有我犯的低级错误，libuv 核心开发 Saghul 为 QuickJS 搭建的 <a href="http://link.zhihu.com/?target=https%3A//github.com/saghul/txiki.js" class=" wrap external" target="_blank" rel="nofollow noreferrer">Txiki</a> 运行时，也遇到过这个问题。不过 Txiki 的这个 <a href="http://link.zhihu.com/?target=https%3A//github.com/saghul/txiki.js/issues/107" class=" wrap external" target="_blank" rel="nofollow noreferrer">Issue</a>，既是我发现的，也是我修复的（嘿嘿），下面就简单讲讲问题所在吧。</p><p>确实，微任务队列应该在 check 阶段清空。对文件 IO 等常见情形这符合规范，也是 Node.js 源码中的实现方式，但对 timer 来说则存在着例外。让我们重新看下 libuv 中 Tick 的各个阶段吧：</p><div class="highlight"><pre><code class="language-text"><span></span>   ┌───────────────────────────┐
┌─&gt;│           timers          │
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │     pending callbacks     │
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │       idle, prepare       │
│  └─────────────┬─────────────┘      ┌───────────────┐
│  ┌─────────────┴─────────────┐      │   incoming:   │
│  │           poll            │&lt;─────┤  connections, │
│  └─────────────┬─────────────┘      │   data, etc.  │
│  ┌─────────────┴─────────────┐      └───────────────┘
│  │           check           │
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
└──┤      close callbacks      │
   └───────────────────────────┘
</code></pre></div><p>注意到了吗？<b>timer 的回调始终是最先执行的</b>，比 check 回调还要早。这也就意味着，每次 eval 结束后的 Tick 中，都会先执行 setTimeout 对应的 timer 回调，然后才是 Promise 的回调。这就导致了执行顺序上的问题了。</p><p>为了解决这个 timer 的问题，我们可以做个特殊处理：<b>在 timer 回调中清空微任务队列即可</b>。这也就相当于，在 timer 的 C 回调中再把 <code>JS_ExecutePendingJob</code> 的 for 循环跑一遍。相应的代码实现，可以参考我为 Txiki 提的这个 <a href="http://link.zhihu.com/?target=https%3A//github.com/saghul/txiki.js/pull/110" class=" wrap external" target="_blank" rel="nofollow noreferrer">PR</a>，其中还包括了这类异步场景的测试用例呢。</p><p>到此为止，我们就基于 libuv 实现了一个符合标准的 JS 运行时 Event Loop 啦——虽然它只支持 timer，但也不难基于 libuv 继续为其扩展其它能力。如果你对如何接入更多的 libuv 能力到 JS 引擎感兴趣，Txiki 也是个很好的起点。</p><blockquote>思考题：这个微任务队列，能否支持调整单次任务执行的数量限制呢？能否在运行时动态调整呢？如果可以，该如何构造出相应的 JS 测试用例呢？</blockquote><h2>参考资料</h2><p>最后，这里列出一些在学习 libuv 和 Event Loop 时主要的参考资料：</p><ul><li><a href="http://link.zhihu.com/?target=http%3A//docs.libuv.org/en/v1.x/design.html" class=" wrap external" target="_blank" rel="nofollow noreferrer">libuv 设计概览</a></li><li><a href="http://link.zhihu.com/?target=https%3A//html.spec.whatwg.org/multipage/webappapis.html%23task-queue" class=" wrap external" target="_blank" rel="nofollow noreferrer">Task Queue 规范</a></li><li><a href="http://link.zhihu.com/?target=https%3A//stackoverflow.com/questions/25915634/difference-between-microtask-and-macrotask-within-an-event-loop-context" class=" wrap external" target="_blank" rel="nofollow noreferrer">Microtask / Macrotask 区别</a></li></ul><p>本篇的代码示例已经整理到了我的 <a href="http://link.zhihu.com/?target=https%3A//github.com/doodlewind/minimal-js-runtime" class=" wrap external" target="_blank" rel="nofollow noreferrer">Minimal JS Runtime</a> 项目里，它的编译使用完全无需修改 QuickJS 和 libuv 的上游代码，欢迎大家尝试噢。上篇中的 QuickJS 原生 Event Loop 集成示例也在里面，参见 README 即可。</p><h2>后记</h2><p>可能也只有 2020 年这个特殊的春节，有条件让人在家里认真钻研技术并连载专栏了吧。全文中我原以为最难的地方，还是大年三十晚上在莆田的一个小村子里完成的，也算是一种特别的体验吧。</p><p>毕业几年来，我的工作一直是写 JS 的。这次从 JS 转来写点 C，其实也没有什么特别难的，就是有些不方便，大概相当于把智能手机换成了诺基亚吧…毕竟都是不同时代背景下设计给人用的工具而已，不用太过于纠结它们啦。毕竟真正的大牛可以把 C 写得出神入化，对我来说，前面的路还很长。</p><p>受水平所限，本文的内容显然还远不算深入（例如该如何集成调试器，如何支持 Worker，如何与原生渲染线程交互…）。但如果大家对 JS 运行时的实现感兴趣，相信本文应该足够成为一篇合格的入门指南。并且，我相信这条路线还能为广大前端同学们找到一种新的可能性：只要少量的 C / C++ 配合现代的 JavaScript，就能使传统的 Web 技术栈走出浏览器，将 JavaScript 像 Lua 那样嵌入使用了。在这条路线上还能做到哪些有趣的事情呢？敬请关注我的「<a href="https://zhuanlan.zhihu.com/fe-fantasy" class="internal">前端随想录</a>」专栏噢～</p>