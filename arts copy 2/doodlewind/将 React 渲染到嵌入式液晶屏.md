<p>我们都知道，React 最大的卖点之一，就是 Learn once, write anywhere 的通用性。但如何才能在浏览器之外，甚至在 Node.js 之外，用 React 渲染 UI 呢？本文将带你用 React 直通嵌入式驱动层，让现代前端技术与古老的硬件无缝结合。</p><h2>背景概述</h2><p>本次我们的渲染目标，是一块仅 0.96 寸大的点阵液晶屏，型号为 SSD1306。它的分辨率仅 128x64，你可能在早期黑白 MP3 时代用它滚动播放过歌词。这块芯片到底有多小呢？我拍了张实物对比图：</p><figure data-size="normal"><img src="https://pic3.zhimg.com/v2-795187d565e3fa753a5e3acf3b97c722_b.jpg" data-caption="" data-size="normal" data-rawwidth="1500" data-rawheight="1125" class="origin_image zh-lightbox-thumb" width="1500" data-original="https://pic3.zhimg.com/v2-795187d565e3fa753a5e3acf3b97c722_r.jpg"></figure><p>一般的 PC 显然不会直接支持这种硬件，因此我们需要嵌入式的开发环境——我选择了最方便的树莓派。</p><p>虽然树莓派已经具备了完善的 Python 和 Node.js 等现成的语言环境，但我希望挑战极限，按照「能够将 React 运行在最低配置的硬件环境上」的方式来做技术选型。为此我寻找的是面向嵌入式硬件的超轻量 JS 解释器，来替代浏览器和 Node.js 上较为沉重的 V8。最后我选择了 <a href="http://link.zhihu.com/?target=https%3A//bellard.org/quickjs/" class=" wrap external" target="_blank" rel="nofollow noreferrer">QuickJS</a>，一个年轻但系出名门的 JS 引擎。</p><p>所以简单说，我们的目标是<b>打通 React → QuickJS → 树莓派 → SSD1306 芯片这四个体系</b>。这个初看起来困难的目标，可以拆分为如下的几个步骤：</p><ul><li>将 React 移植到嵌入式 JS 引擎上</li><li>基于 C 语言驱动硬件</li><li>为 JS 引擎封装 C 语言扩展</li><li>实现 React 渲染后端</li></ul><p>上面的每一步虽然都不算难，但也都足够写篇独立的技术博客了。为保持可读性，本文只能尽量覆盖核心概念与关键步骤。不过我可以先向你保证，最后的整个项目不仅代码足够简单，还是自由而开源的。</p><p>让我们开始吧！</p><h2>将 React 移植到嵌入式 JS 引擎上</h2><p>其实，QuickJS 并不是唯一的嵌入式 JS 引擎，之前社区已有 DukTape 和 XS 等不少面向 IoT 硬件的 JS 引擎，但一直不温不火。相比之下 QuickJS 最吸引我的地方，有这么几点：</p><ul><li><b>几乎完整的 ES2019 支持</b>。从 ES Module 到 async 和 Proxy，这些我们早已习惯的 Modern JS 语法，都是 QuickJS 已经支持，并通过了 Test262 测试的。相比之下，其他嵌入式 JS 引擎连 ES6 的支持都未必足够。</li><li><b>轻便灵活、可嵌入性强</b>。很多前端同学喜欢深入研究的 V8 引擎，其实连自己编译一份都相当困难。相比之下 QuickJS 无任何依赖，一句 make 就能编译好，二进制体积不到 700KB，也非常容易嵌入各类原生项目。</li><li><b>作者的个人实力</b>。作者 Fabrice Bellard 对我来说是神级的存在。像安卓模拟器底层的 QEMU 和音视频开发者必备的 FFmpeg，都是他创造的杰作。每当我技术有些进步，访问他的 <a href="http://link.zhihu.com/?target=https%3A//bellard.org/" class=" wrap external" target="_blank" rel="nofollow noreferrer">Home Page</a>  时总能让我清晰地认识到自己的渺小。</li></ul><p>但是，QuickJS 毕竟还只是个刚发布几个月的新项目而已，敢于尝鲜的人并不多。即便通过了各种单元测试，它真的能稳定运行起 React 这样的工业级 JS 项目吗？这是决定这条技术路线可行性的关键问题。</p><p>为此，我们当然需要先实际用上 QuickJS。它的源码是跨平台的，并非只能在 Linux 或树莓派上运行。在我的 macOS 上，拉下代码一套素质三连即可：</p><div class="highlight"><pre><code class="language-bash"><span></span><span class="nb">cd</span> quickjs
make
sudo make install
</code></pre></div><p>这样，我们就可以在终端输入 <code>qjs</code> 命令来进入 QuickJS 解释器了。只要形如 <code>qjs foo.js</code> 的形式，即可用它执行你的脚本。再加上 <code>-m</code> 参数，它就能支持载入 ES Module (ESM) 形式的模块，直接运行起整个模块化的 JS 项目了。</p><blockquote> 注意，在 QuickJS 中使用 ESM 时，必须给路径加上完整的  <code>.js</code> 后缀。这和浏览器中对直接加载 ESM 的要求是一致的。</blockquote><p>不过，QuickJS 并不能直接运行「我们日常写的那种 React」，毕竟标签式的 JSX 只是方言，不是业界标准。怎么办呢？作为变通，我引入了辅助的 Node.js 环境，先用 Rollup 打包并转译 JSX 代码为 ESM 格式，再交给 QuickJS 执行。这个辅助环境的 node_modules 体积只有 10M 不到，具体配置不再赘述。</p><p>很快关键的一步就来了，你觉得 <code>qjs react.js</code> 真的能用吗？这时就体现出 React 的设计优越性了——早在两年前 React 16.0 发布时，React 就在架构上分离了上层的 <code>react</code> 和下层的默认 DOM 渲染器 <code>react-dom</code>，它们通过 <code>react-reconciler</code> 封装的 Fiber 中间层来连接。<code>react</code> 包没有对 DOM 的依赖，是可以独立在纯 JS 环境下运行的。这种工程设计虽然增大了整体的项目体积，但对于我们这种要定制渲染后端的场合则非常有用，也是个 React 比 Vue 已经领先了两年有余的地方。如何验证 React 可用呢？编写个最简单的无状态组件试试就行了：</p><div class="highlight"><pre><code class="language-js"><span></span><span class="kr">import</span> <span class="s1">'./polyfill.js'</span>
<span class="kr">import</span> <span class="nx">React</span> <span class="nx">from</span> <span class="s1">'react'</span>

<span class="kr">const</span> <span class="nx">App</span> <span class="o">=</span> <span class="nx">props</span> <span class="p">=&gt;</span> <span class="p">{</span>
  <span class="nx">console</span><span class="p">.</span><span class="nx">log</span><span class="p">(</span><span class="nx">props</span><span class="p">.</span><span class="nx">hello</span><span class="p">)</span>
  <span class="k">return</span> <span class="kc">null</span>
<span class="p">}</span>

<span class="nx">console</span><span class="p">.</span><span class="nx">log</span><span class="p">(</span><span class="o">&lt;</span><span class="nx">App</span> <span class="nx">hello</span><span class="o">=</span><span class="p">{</span><span class="s1">'QuickJS'</span><span class="p">}</span> <span class="o">/&gt;</span><span class="p">)</span>
</code></pre></div><p>注意到 <code>polyfill.js</code> 了吗？这是将 React 移植到 QuickJS 环境所需的兼容代码。看起来这种兼容工作可能很困难，但其实非常简单，就像这样：</p><div class="highlight"><pre><code class="language-js"><span></span><span class="c1">// QuickJS 约定的全局变量为 globalThis</span>
<span class="nx">globalThis</span><span class="p">.</span><span class="nx">process</span> <span class="o">=</span> <span class="p">{</span> <span class="nx">env</span><span class="o">:</span> <span class="p">{</span> <span class="nx">NODE_ENV</span><span class="o">:</span> <span class="s1">'development'</span> <span class="p">}</span> <span class="p">}</span>
<span class="nx">globalThis</span><span class="p">.</span><span class="nx">console</span><span class="p">.</span><span class="nx">warn</span> <span class="o">=</span> <span class="nx">console</span><span class="p">.</span><span class="nx">log</span>
</code></pre></div><p>这么点代码由 Rollup 打包后，执行 <code>qjs dist.js</code> 即可获得这样的结果：</p><div class="highlight"><pre><code class="language-bash"><span></span>$ qjs ./dist.js
QuickJS
null
</code></pre></div><p>这说明 <code>React.createElement</code> 能正确执行，Props 的传递也没有问题。这个结果让我很兴奋，因为即使停在这一步，也已经说明了：</p><ul><li>QuickJS 完全可以直接运行工业界中 Battle-Tested 的框架。</li><li><code>npm install react</code> 的源码，能够<b>一行不改地</b>运行在符合标准的 JS 引擎上。</li></ul><p>好了，QuickJS 牛逼！React 牛逼！接下来该干嘛呢？</p><h2>基于 C 语言驱动硬件</h2><p>我们已经让 React 顺利地在 QuickJS 引擎上执行了。但别忘了我们的目标——将 React 直接渲染到<b>液晶屏</b>！该如何在液晶屏上渲染内容呢？最贴近硬件的 C 语言肯定是最方便的。但在开始编码之前，我们需要搞明白这些概念：</p><ul><li>要想控制 SSD1306 这块芯片，最简单的方式是通过 I2C 通信协议。这就和 U 盘支持 USB 协议是一个道理。</li><li>一般的 PC 主板上没有 I2C 接口，但树莓派上有，只要连接几个针脚就行。</li><li>连接了支持 I2C 的设备后，就可以在操作系统中控制它了。我们知道 Linux 里一切皆文件，因此这个屏幕也会被当成文件，挂载到 <code>/dev</code> 目录下。</li><li>对于文件，只需通过 C 语言编写 Unix 的 <a href="http://link.zhihu.com/?target=http%3A//man7.org/linux/man-pages/man2/open.2.html" class=" wrap external" target="_blank" rel="nofollow noreferrer">open</a> / <a href="http://link.zhihu.com/?target=http%3A//man7.org/linux/man-pages/man2/write.2.html" class=" wrap external" target="_blank" rel="nofollow noreferrer">write</a> 等系统调用，就能读写控制了。不过 I2C 显示屏毕竟不是普通文件，是通过 Linux 内核里的驱动控制的。为此我们需要安装 <a href="http://link.zhihu.com/?target=https%3A//www.kernel.org/doc/Documentation/i2c/dev-interface" class=" wrap external" target="_blank" rel="nofollow noreferrer">libi2c-dev</a> 这个包，以便在用户态通过 <a href="http://link.zhihu.com/?target=http%3A//man7.org/linux/man-pages/man2/ioctl.2.html" class=" wrap external" target="_blank" rel="nofollow noreferrer">ioctl</a> 系统调用来控制它。</li></ul><p>我们首先需要将屏幕芯片连接到树莓派上。方法如下（树莓派引脚号可以用 <code>pinout</code> 命令查看）：</p><ul><li>芯片 Vcc 端接树莓派 1 号引脚，这是 3.3V 的电源输入</li><li>芯片 Gnd 端接树莓派 14 号引脚，这是地线</li><li>芯片 SCL 端接树莓派 5 号引脚，这是 I2C 规范的 SCL 口</li><li>芯片 SDA 端接树莓派 3 号引脚，这是 I2C 规范的 SDA 口</li></ul><p>连接好之后，大概是这样的：</p><figure data-size="normal"><img src="https://pic4.zhimg.com/v2-36d51cd8274ef90ac7b6e330342f5913_b.jpg" data-caption="" data-size="normal" data-rawwidth="1500" data-rawheight="1125" class="origin_image zh-lightbox-thumb" width="1500" data-original="https://pic4.zhimg.com/v2-36d51cd8274ef90ac7b6e330342f5913_r.jpg"></figure><p>然后，在树莓派「开始菜单」的 System Configuration 中，启用 Interface 中的 I2C 项（这步也能敲命令处理）并重启，即可启用 I2C 支持。</p><p>硬件和系统都配置好之后，我们来安装 I2C 的一些工具包：</p><div class="highlight"><pre><code class="language-bash"><span></span>sudo apt-get install i2c-tools libi2c-dev
</code></pre></div><p>如何验证上面这套流程 OK 了呢？使用 <code>i2cdetect</code> 命令即可。如果看到下面这样在 <code>3c</code> 位置有值的结果，说明屏幕已经正确挂载了：</p><div class="highlight"><pre><code class="language-bash"><span></span>$ i2cdetect -y <span class="m">1</span>
     <span class="m">0</span>  <span class="m">1</span>  <span class="m">2</span>  <span class="m">3</span>  <span class="m">4</span>  <span class="m">5</span>  <span class="m">6</span>  <span class="m">7</span>  <span class="m">8</span>  <span class="m">9</span>  a  b  c  d  e  f
<span class="m">00</span>:          -- -- -- -- -- -- -- -- -- -- -- -- --
<span class="m">10</span>: -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- --
<span class="m">20</span>: -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- --
<span class="m">30</span>: -- -- -- -- -- -- -- -- -- -- -- -- 3c -- -- --
<span class="m">40</span>: -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- --
<span class="m">50</span>: -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- --
<span class="m">60</span>: -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- --
<span class="m">70</span>: -- -- -- -- -- -- -- -- 
</code></pre></div><p>环境配置完成后，我们就可以编写用 open / write / ioctl 等系统调用来控制屏幕的 C 代码了。这需要对 I2C 通信协议有些了解，好在有不少现成的轮子可以用。这里用的是 <a href="http://link.zhihu.com/?target=https%3A//github.com/bitbank2/oled_96" class=" wrap external" target="_blank" rel="nofollow noreferrer">oled96</a> 库，基于它的示例代码大概这样：</p><div class="highlight"><pre><code class="language-c"><span></span><span class="c1">// demo.c</span>
<span class="cp">#include</span> <span class="cpf">&lt;stdint.h&gt;</span><span class="cp"></span>
<span class="cp">#include</span> <span class="cpf">&lt;string.h&gt;</span><span class="cp"></span>
<span class="cp">#include</span> <span class="cpf">&lt;stdio.h&gt;</span><span class="cp"></span>
<span class="cp">#include</span> <span class="cpf">&lt;stdlib.h&gt;</span><span class="cp"></span>
<span class="cp">#include</span> <span class="cpf">&lt;unistd.h&gt;</span><span class="cp"></span>
<span class="cp">#include</span> <span class="cpf">"oled96.h"</span><span class="cp"></span>

<span class="kt">int</span> <span class="nf">main</span><span class="p">(</span><span class="kt">int</span> <span class="n">argc</span><span class="p">,</span> <span class="kt">char</span> <span class="o">*</span><span class="n">argv</span><span class="p">[])</span>
<span class="p">{</span>
    <span class="c1">// 初始化</span>
    <span class="kt">int</span> <span class="n">iChannel</span> <span class="o">=</span> <span class="mi">1</span><span class="p">,</span> <span class="n">bFlip</span> <span class="o">=</span> <span class="mi">0</span><span class="p">,</span> <span class="n">bInvert</span> <span class="o">=</span> <span class="mi">0</span><span class="p">;</span>
    <span class="kt">int</span> <span class="n">iOLEDAddr</span> <span class="o">=</span> <span class="mh">0x3c</span><span class="p">;</span>
    <span class="kt">int</span> <span class="n">iOLEDType</span> <span class="o">=</span> <span class="n">OLED_128x64</span><span class="p">;</span>
    <span class="n">oledInit</span><span class="p">(</span><span class="n">iChannel</span><span class="p">,</span> <span class="n">iOLEDAddr</span><span class="p">,</span> <span class="n">iOLEDType</span><span class="p">,</span> <span class="n">bFlip</span><span class="p">,</span> <span class="n">bInvert</span><span class="p">);</span>

    <span class="c1">// 清屏后渲染文字和像素</span>
    <span class="n">oledFill</span><span class="p">(</span><span class="mi">0</span><span class="p">);</span>
    <span class="n">oledWriteString</span><span class="p">(</span><span class="mi">0</span><span class="p">,</span> <span class="mi">0</span><span class="p">,</span> <span class="s">"Hello OLED!"</span><span class="p">,</span> <span class="n">FONT_SMALL</span><span class="p">);</span>
    <span class="n">oledSetPixel</span><span class="p">(</span><span class="mi">42</span><span class="p">,</span> <span class="mi">42</span><span class="p">,</span> <span class="mi">1</span><span class="p">);</span>

    <span class="c1">// 在用户输入后关闭屏幕</span>
    <span class="n">printf</span><span class="p">(</span><span class="s">"Press ENTER to quit!</span><span class="se">\n</span><span class="s">"</span><span class="p">);</span>
    <span class="n">getchar</span><span class="p">();</span>
    <span class="n">oledShutdown</span><span class="p">();</span>
<span class="p">}</span>
</code></pre></div><p>这个示例只需要 <code>gcc demo.c</code> 命令就能运行。不出意外的话，运行编译产生的 <code>./a.out</code> 即可点亮屏幕。这一步编写的代码也很浅显易懂，真正较复杂的地方在于 oled96 驱动层的通信实现。有兴趣的同学可以读读它的源码噢。</p><h2>为 JS 引擎封装 C 语言扩展</h2><p>现在，React 世界和硬件世界分别都能正常运转了。但如何连接它们呢？我们需要为 QuickJS 引擎开发 C 语言模块。</p><p>QuickJS 中默认内置了 <code>os</code> 和 <code>std</code> 两个原生模块，比如我们司空见惯的这种代码：</p><div class="highlight"><pre><code class="language-js"><span></span><span class="kr">const</span> <span class="nx">hello</span> <span class="o">=</span> <span class="s1">'Hello'</span>
<span class="nx">console</span><span class="p">.</span><span class="nx">log</span><span class="p">(</span><span class="sb">`</span><span class="si">${</span><span class="nx">hello</span><span class="si">}</span><span class="sb"> World!`</span><span class="p">)</span>
</code></pre></div><p>其实在 QuickJS 中也能换成这样写：</p><div class="highlight"><pre><code class="language-js"><span></span><span class="kr">import</span> <span class="o">*</span> <span class="nx">as</span> <span class="nx">std</span> <span class="nx">from</span> <span class="s1">'std'</span>

<span class="kr">const</span> <span class="nx">hello</span> <span class="o">=</span> <span class="s1">'Hello'</span>
<span class="nx">std</span><span class="p">.</span><span class="nx">out</span><span class="p">.</span><span class="nx">printf</span><span class="p">(</span><span class="s1">'%s World!'</span><span class="p">,</span> <span class="nx">hello</span><span class="p">)</span>
</code></pre></div><p>有没有种 C 语言换壳的感觉？这里的 <code>std</code> 模块其实就是作者为 C 语言 <code>stdlib.h</code> 和 <code>stdio.h</code> 实现的 JS Binding。那我如果想自己实现其他的 C 模块，该怎么办呢？官方文档大手一挥，告诉你「直接照我的源码来写就行」——敢把核心源码当作面向小白的示例，可能这就是大神吧。</p><p>一番折腾后，我发现 QuickJS 在接入原生模块时的设计，非常的「艺高人胆大」。首先我们要知道的是，在 <code>qjs</code> 之外，QuickJS 还提供了个 <code>qjsc</code> 命令，能将一份写了 Hello World 的 <code>hello.js</code> 直接编译到二进制可执行文件，或者这样的 C 代码：</p><div class="highlight"><pre><code class="language-c"><span></span><span class="cm">/* File generated automatically by the QuickJS compiler. */</span>
<span class="cp">#include</span> <span class="cpf">"quickjs-libc.h"</span><span class="cp"></span>
<span class="k">const</span> <span class="kt">uint32_t</span> <span class="n">qjsc_hello_size</span> <span class="o">=</span> <span class="mi">87</span><span class="p">;</span>
<span class="k">const</span> <span class="kt">uint8_t</span> <span class="n">qjsc_hello</span><span class="p">[</span><span class="mi">87</span><span class="p">]</span> <span class="o">=</span> <span class="p">{</span>
 <span class="mh">0x01</span><span class="p">,</span> <span class="mh">0x04</span><span class="p">,</span> <span class="mh">0x0e</span><span class="p">,</span> <span class="mh">0x63</span><span class="p">,</span> <span class="mh">0x6f</span><span class="p">,</span> <span class="mh">0x6e</span><span class="p">,</span> <span class="mh">0x73</span><span class="p">,</span> <span class="mh">0x6f</span><span class="p">,</span>
 <span class="mh">0x6c</span><span class="p">,</span> <span class="mh">0x65</span><span class="p">,</span> <span class="mh">0x06</span><span class="p">,</span> <span class="mh">0x6c</span><span class="p">,</span> <span class="mh">0x6f</span><span class="p">,</span> <span class="mh">0x67</span><span class="p">,</span> <span class="mh">0x16</span><span class="p">,</span> <span class="mh">0x48</span><span class="p">,</span>
 <span class="mh">0x65</span><span class="p">,</span> <span class="mh">0x6c</span><span class="p">,</span> <span class="mh">0x6c</span><span class="p">,</span> <span class="mh">0x6f</span><span class="p">,</span> <span class="mh">0x20</span><span class="p">,</span> <span class="mh">0x57</span><span class="p">,</span> <span class="mh">0x6f</span><span class="p">,</span> <span class="mh">0x72</span><span class="p">,</span>
 <span class="mh">0x6c</span><span class="p">,</span> <span class="mh">0x64</span><span class="p">,</span> <span class="mh">0x22</span><span class="p">,</span> <span class="mh">0x65</span><span class="p">,</span> <span class="mh">0x78</span><span class="p">,</span> <span class="mh">0x61</span><span class="p">,</span> <span class="mh">0x6d</span><span class="p">,</span> <span class="mh">0x70</span><span class="p">,</span>
 <span class="mh">0x6c</span><span class="p">,</span> <span class="mh">0x65</span><span class="p">,</span> <span class="mh">0x73</span><span class="p">,</span> <span class="mh">0x2f</span><span class="p">,</span> <span class="mh">0x68</span><span class="p">,</span> <span class="mh">0x65</span><span class="p">,</span> <span class="mh">0x6c</span><span class="p">,</span> <span class="mh">0x6c</span><span class="p">,</span>
 <span class="mh">0x6f</span><span class="p">,</span> <span class="mh">0x2e</span><span class="p">,</span> <span class="mh">0x6a</span><span class="p">,</span> <span class="mh">0x73</span><span class="p">,</span> <span class="mh">0x0d</span><span class="p">,</span> <span class="mh">0x00</span><span class="p">,</span> <span class="mh">0x06</span><span class="p">,</span> <span class="mh">0x00</span><span class="p">,</span>
 <span class="mh">0x9e</span><span class="p">,</span> <span class="mh">0x01</span><span class="p">,</span> <span class="mh">0x00</span><span class="p">,</span> <span class="mh">0x01</span><span class="p">,</span> <span class="mh">0x00</span><span class="p">,</span> <span class="mh">0x03</span><span class="p">,</span> <span class="mh">0x00</span><span class="p">,</span> <span class="mh">0x00</span><span class="p">,</span>
 <span class="mh">0x14</span><span class="p">,</span> <span class="mh">0x01</span><span class="p">,</span> <span class="mh">0xa0</span><span class="p">,</span> <span class="mh">0x01</span><span class="p">,</span> <span class="mh">0x00</span><span class="p">,</span> <span class="mh">0x00</span><span class="p">,</span> <span class="mh">0x00</span><span class="p">,</span> <span class="mh">0x39</span><span class="p">,</span>
 <span class="mh">0xd0</span><span class="p">,</span> <span class="mh">0x00</span><span class="p">,</span> <span class="mh">0x00</span><span class="p">,</span> <span class="mh">0x00</span><span class="p">,</span> <span class="mh">0x43</span><span class="p">,</span> <span class="mh">0xd1</span><span class="p">,</span> <span class="mh">0x00</span><span class="p">,</span> <span class="mh">0x00</span><span class="p">,</span>
 <span class="mh">0x00</span><span class="p">,</span> <span class="mh">0x04</span><span class="p">,</span> <span class="mh">0xd2</span><span class="p">,</span> <span class="mh">0x00</span><span class="p">,</span> <span class="mh">0x00</span><span class="p">,</span> <span class="mh">0x00</span><span class="p">,</span> <span class="mh">0x24</span><span class="p">,</span> <span class="mh">0x01</span><span class="p">,</span>
 <span class="mh">0x00</span><span class="p">,</span> <span class="mh">0xcc</span><span class="p">,</span> <span class="mh">0x28</span><span class="p">,</span> <span class="mh">0xa6</span><span class="p">,</span> <span class="mh">0x03</span><span class="p">,</span> <span class="mh">0x01</span><span class="p">,</span> <span class="mh">0x00</span><span class="p">,</span>
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
<span class="p">}</span>
</code></pre></div><p>你的 Hello World 去哪了？就在这个大数组的<b>字节码</b>里呢。这里一些形如 <code>JS_NewRuntime</code> 的 C 方法，其实就是 QuickJS 对外 API 的一部分。你可以参考这种方式，在原生项目里接入 QuickJS——真正的大神，即便把自己的代码编译一遍，还是示例级的教程代码。</p><p>搞懂这个过程后不难发现，QuickJS 中最简单的原生模块使用方式，其实是这样的：</p><ol><li>用 <code>qjsc</code> 将全部 JS 代码，编译成 C 语言的 <code>main.c</code> 入口</li><li>依次将你的各个 C 源码，用 <code>gcc -c</code> 命令编译为 <code>.o</code> 格式的目标文件</li><li>编译 <code>main.c</code> 并链接上这些 <code>.o</code> 文件，获得最终的 <code>main</code> 可执行文件</li></ol><p>看懂了吗？这个操作的核心在于<b>先把 JS 编译成普通的 C，再在 C 的世界里链接各种原生模块</b>。虽然有些奇幻，但好处是这样不需要魔改 QuickJS 源码就能实现。按这种方式，我基于 oled96 实现了个名为 <code>renderer.c</code> 的 C 模块，它会提供名为 <code>renderer</code> 的 JS 原生模块。其整体实现大致是这样的：</p><div class="highlight"><pre><code class="language-c"><span></span><span class="c1">// 用于初始化 OLED 的 C 函数</span>
<span class="n">JSValue</span> <span class="nf">nativeInit</span><span class="p">(</span><span class="n">JSContext</span> <span class="o">*</span><span class="n">ctx</span><span class="p">,</span> <span class="n">JSValueConst</span> <span class="n">this_val</span><span class="p">,</span> <span class="kt">int</span> <span class="n">argc</span><span class="p">,</span> <span class="n">JSValueConst</span> <span class="o">*</span><span class="n">argv</span><span class="p">)</span>
<span class="p">{</span>
    <span class="k">const</span> <span class="kt">int</span> <span class="n">bInvert</span> <span class="o">=</span> <span class="n">JS_ToBool</span><span class="p">(</span><span class="n">ctx</span><span class="p">,</span> <span class="n">argv</span><span class="p">[</span><span class="mi">0</span><span class="p">]);</span>
    <span class="k">const</span> <span class="kt">int</span> <span class="n">bFlip</span> <span class="o">=</span> <span class="n">JS_ToBool</span><span class="p">(</span><span class="n">ctx</span><span class="p">,</span> <span class="n">argv</span><span class="p">[</span><span class="mi">1</span><span class="p">]);</span>
    <span class="kt">int</span> <span class="n">iChannel</span> <span class="o">=</span> <span class="mi">1</span><span class="p">;</span>
    <span class="kt">int</span> <span class="n">iOLEDAddr</span> <span class="o">=</span> <span class="mh">0x3c</span><span class="p">;</span>
    <span class="kt">int</span> <span class="n">iOLEDType</span> <span class="o">=</span> <span class="n">OLED_128x64</span><span class="p">;</span>
    <span class="n">oledInit</span><span class="p">(</span><span class="n">iChannel</span><span class="p">,</span> <span class="n">iOLEDAddr</span><span class="p">,</span> <span class="n">iOLEDType</span><span class="p">,</span> <span class="n">bFlip</span><span class="p">,</span> <span class="n">bInvert</span><span class="p">);</span>
    <span class="n">oledFill</span><span class="p">(</span><span class="mi">0</span><span class="p">);</span>
    <span class="k">return</span> <span class="n">JS_NULL</span><span class="p">;</span>
<span class="p">}</span>

<span class="c1">// 用于绘制像素的 C 函数</span>
<span class="n">JSValue</span> <span class="nf">nativeDrawPixel</span><span class="p">(</span><span class="n">JSContext</span> <span class="o">*</span><span class="n">ctx</span><span class="p">,</span> <span class="n">JSValueConst</span> <span class="n">this_val</span><span class="p">,</span> <span class="kt">int</span> <span class="n">argc</span><span class="p">,</span> <span class="n">JSValueConst</span> <span class="o">*</span><span class="n">argv</span><span class="p">)</span>
<span class="p">{</span>
    <span class="kt">int</span> <span class="n">x</span><span class="p">,</span> <span class="n">y</span><span class="p">;</span>
    <span class="n">JS_ToInt32</span><span class="p">(</span><span class="n">ctx</span><span class="p">,</span> <span class="o">&amp;</span><span class="n">x</span><span class="p">,</span> <span class="n">argv</span><span class="p">[</span><span class="mi">0</span><span class="p">]);</span>
    <span class="n">JS_ToInt32</span><span class="p">(</span><span class="n">ctx</span><span class="p">,</span> <span class="o">&amp;</span><span class="n">y</span><span class="p">,</span> <span class="n">argv</span><span class="p">[</span><span class="mi">1</span><span class="p">]);</span>
    <span class="n">oledSetPixel</span><span class="p">(</span><span class="n">x</span><span class="p">,</span> <span class="n">y</span><span class="p">,</span> <span class="mi">1</span><span class="p">);</span>
    <span class="k">return</span> <span class="n">JS_NULL</span><span class="p">;</span>
<span class="p">}</span>

<span class="c1">// 定义 JS 侧所需的函数名与参数长度信息</span>
<span class="k">const</span> <span class="n">JSCFunctionListEntry</span> <span class="n">nativeFuncs</span><span class="p">[]</span> <span class="o">=</span> <span class="p">{</span>
    <span class="n">JS_CFUNC_DEF</span><span class="p">(</span><span class="s">"init"</span><span class="p">,</span> <span class="mi">2</span><span class="p">,</span> <span class="n">nativeInit</span><span class="p">),</span>
    <span class="n">JS_CFUNC_DEF</span><span class="p">(</span><span class="s">"drawPixel"</span><span class="p">,</span> <span class="mi">2</span><span class="p">,</span> <span class="n">nativeDrawPixel</span><span class="p">)};</span>

<span class="c1">// 其他的一些胶水代码</span>
<span class="c1">// ...</span>
</code></pre></div><p>整个包含了 C 模块的项目编译步骤，如果手动执行则较为复杂。因此我们选择引入 GNU Make 来表达整个构建流程。由于是第一次写 Makefile，这个过程对我有些困扰。不过搞懂原理后，它其实也没那么可怕。感兴趣的同学可以自己查看后面开源仓库地址中的实现噢。</p><p>只要上面的 C 模块编译成功，我们就能用这种前端同学们信手拈来的 JS 代码，直接驱动这块屏幕了：</p><div class="highlight"><pre><code class="language-js"><span></span><span class="c1">// main.js</span>
<span class="kr">import</span> <span class="p">{</span> <span class="nx">setTimeout</span> <span class="p">}</span> <span class="nx">from</span> <span class="s1">'os'</span>
<span class="kr">import</span> <span class="p">{</span> <span class="nx">init</span><span class="p">,</span> <span class="nx">clear</span><span class="p">,</span> <span class="nx">drawText</span> <span class="p">}</span> <span class="nx">from</span> <span class="s1">'renderer'</span>

<span class="kr">const</span> <span class="nx">wait</span> <span class="o">=</span> <span class="nx">timeout</span> <span class="p">=&gt;</span>
  <span class="k">new</span> <span class="nb">Promise</span><span class="p">(</span><span class="nx">resolve</span> <span class="p">=&gt;</span> <span class="nx">setTimeout</span><span class="p">(</span><span class="nx">resolve</span><span class="p">,</span> <span class="nx">timeout</span><span class="p">))</span>

<span class="p">;(</span><span class="nx">async</span> <span class="p">()</span> <span class="p">=&gt;</span> <span class="p">{</span>
  <span class="kr">const</span> <span class="nx">invert</span> <span class="o">=</span> <span class="kc">false</span>
  <span class="kr">const</span> <span class="nx">flip</span> <span class="o">=</span> <span class="kc">false</span>
  <span class="nx">init</span><span class="p">(</span><span class="nx">invert</span><span class="p">,</span> <span class="nx">flip</span><span class="p">)</span>
  <span class="nx">clear</span><span class="p">()</span>
  <span class="nx">drawText</span><span class="p">(</span><span class="s1">'Hello world!'</span><span class="p">)</span>
  <span class="nx">await</span> <span class="nx">wait</span><span class="p">(</span><span class="mi">2000</span><span class="p">)</span>

  <span class="nx">clear</span><span class="p">()</span>
  <span class="nx">drawText</span><span class="p">(</span><span class="s1">'Again!'</span><span class="p">)</span>
  <span class="nx">await</span> <span class="nx">wait</span><span class="p">(</span><span class="mi">2000</span><span class="p">)</span>

  <span class="nx">clear</span><span class="p">()</span>
<span class="p">})()</span>
</code></pre></div><p>其实，很多树莓派上著名的 Python 模块，也都为你做好了这一步。那为什么要用 JS 重新实现一遍呢？因为只有 JS 上才有 Learn once, write anywhere 的 React 呀！让我们走出最后一步，将 React 与这块液晶屏连接起来吧。</p><h2>实现 React 渲染后端</h2><p>为 React 实现渲染后端，听起来是件非常高大上的事情。其实这玩意很可能并没有你想象的那么复杂，社区也有 <a href="http://link.zhihu.com/?target=https%3A//github.com/nitin42/Making-a-custom-React-renderer" class=" wrap external" target="_blank" rel="nofollow noreferrer">Making a custom React renderer</a> 这样不错的教程，来告诉你如何从零到一地实现自己的渲染器。不过对我来说，光有这份教程还有些不太够。关键在于两个地方：</p><ol><li>这份教程只将 React 渲染到静态的 docx 格式，不支持能持续更新的 UI 界面。</li><li>这份教程没有涉及接入 React Native 式的原生模块。</li></ol><p>这两个问题里，问题 2 已经在上面基本解决了：我们手里已经有了个用 JS 调一次就能画些东西的原生模块。那么剩下的问题就是，该如何实现一个支持按需更新的 React 渲染后端呢？</p><p>我选择的基本设计，是将整个应用分为三个宏观角色：</p><ul><li>事件驱动的 React 体系</li><li>维护原生屏幕状态的容器</li><li>固定帧率运行的渲染 Main Loop</li></ul><p>这些体系是如何协调工作的呢？简单来说，当用户事件触发了 React 中的 setState 后，React 不仅会更新自身的状态树，还会在原生状态容器中做出修改和标记。这样在 Main Loop 的下一帧到来时，我们就能根据标记，按需地刷新屏幕状态了。<b>从事件流向的视角来看</b>，整体架构就像这样：</p><figure data-size="normal"><img src="https://pic1.zhimg.com/v2-307144791772d62c3711b2192edbb790_b.jpg" data-caption="" data-size="normal" data-rawwidth="1920" data-rawheight="1080" class="origin_image zh-lightbox-thumb" width="1920" data-original="https://pic1.zhimg.com/v2-307144791772d62c3711b2192edbb790_r.jpg"></figure><p>图中的 Native State Container 可以理解为浏览器真实 DOM 这样「不难直接写 JS 操控，但不如交给 React 帮你管理」的状态容器。只要配置正确，React 就会单向地去更新这个容器的状态。而一旦容器状态被更新，这个新状态就会在下一帧被同步到屏幕上。这其实和经典的生产者 - 消费者模型颇为类似。其中 React 是更新容器状态的生产者，而屏幕则是定时检查并消费容器状态的消费者。听起来应该不难吧？</p><p>实现原生状态容器和 Main Loop，其实都是很容易的。最大的问题在于，我们该如何配置好 React，让它自动更新这个状态容器呢？这就需要使用大名鼎鼎的 React Reconciler 了。要想实现一个 React 的 Renderer，其实只要在 Reconciler 的各个生命周期勾子里，正确地更新原生状态容器就行了。<b>从层次结构的视角来看</b>，整体架构则是这样的：</p><figure data-size="normal"><img src="https://pic2.zhimg.com/v2-47ac6815aec27d497f4d8e212720d0b1_b.jpg" data-caption="" data-size="normal" data-rawwidth="1920" data-rawheight="1080" class="origin_image zh-lightbox-thumb" width="1920" data-original="https://pic2.zhimg.com/v2-47ac6815aec27d497f4d8e212720d0b1_r.jpg"></figure><p>可以认为，我们想在 React 中拿来使用的 JS Renderer，更像是一层较薄的壳。它下面依次还有两层重要的结构需要我们实现：</p><ul><li>一个实现了原生状态容器和原生渲染 Loop 的 Adapter 适配层</li><li>真正的 C 语言 Renderer</li></ul><p>React 所用的 Renderer 这层壳的实现，大致像这样：</p><div class="highlight"><pre><code class="language-js"><span></span><span class="kr">import</span> <span class="nx">Reconciler</span> <span class="nx">from</span> <span class="s1">'react-reconciler'</span>
<span class="kr">import</span> <span class="p">{</span> <span class="nx">NativeContainer</span> <span class="p">}</span> <span class="nx">from</span> <span class="s1">'./native-adapter.js'</span>

<span class="kr">const</span> <span class="nx">root</span> <span class="o">=</span> <span class="k">new</span> <span class="nx">NativeContainer</span><span class="p">()</span>
<span class="kr">const</span> <span class="nx">hostConfig</span> <span class="o">=</span> <span class="p">{</span> <span class="cm">/* ... */</span> <span class="p">}</span>
<span class="kr">const</span> <span class="nx">reconciler</span> <span class="o">=</span> <span class="nx">Reconciler</span><span class="p">(</span><span class="nx">hostConfig</span><span class="p">)</span>
<span class="kr">const</span> <span class="nx">container</span> <span class="o">=</span> <span class="nx">reconciler</span><span class="p">.</span><span class="nx">createContainer</span><span class="p">(</span><span class="nx">root</span><span class="p">,</span> <span class="kc">false</span><span class="p">)</span>

<span class="kr">export</span> <span class="kr">const</span> <span class="nx">SSD1306Renderer</span> <span class="o">=</span> <span class="p">{</span>
  <span class="nx">render</span> <span class="p">(</span><span class="nx">reactElement</span><span class="p">)</span> <span class="p">{</span>
    <span class="k">return</span> <span class="nx">reconciler</span><span class="p">.</span><span class="nx">updateContainer</span><span class="p">(</span><span class="nx">reactElement</span><span class="p">,</span> <span class="nx">container</span><span class="p">)</span>
  <span class="p">}</span>
<span class="p">}</span>
</code></pre></div><p>其中我们需要实现个 NativeContainer 容器。这个容器大概是这样的：</p><div class="highlight"><pre><code class="language-js"><span></span><span class="c1">// 导入 QuickJS 原生模块</span>
<span class="kr">import</span> <span class="p">{</span> <span class="nx">init</span><span class="p">,</span> <span class="nx">clear</span><span class="p">,</span> <span class="nx">drawText</span><span class="p">,</span> <span class="nx">drawPixel</span> <span class="p">}</span> <span class="nx">from</span> <span class="s1">'renderer'</span>
<span class="c1">// ...</span>

<span class="kr">export</span> <span class="kr">class</span> <span class="nx">NativeContainer</span> <span class="p">{</span>
  <span class="nx">constructor</span> <span class="p">()</span> <span class="p">{</span>
    <span class="k">this</span><span class="p">.</span><span class="nx">elements</span> <span class="o">=</span> <span class="p">[]</span>
    <span class="k">this</span><span class="p">.</span><span class="nx">synced</span> <span class="o">=</span> <span class="kc">true</span>
    <span class="c1">// 清屏，并开始事件循环</span>
    <span class="nx">init</span><span class="p">()</span>
    <span class="nx">clear</span><span class="p">()</span>
    <span class="nx">mainLoop</span><span class="p">(()</span> <span class="p">=&gt;</span> <span class="k">this</span><span class="p">.</span><span class="nx">onFrameTick</span><span class="p">())</span>
  <span class="p">}</span>
  <span class="c1">// 交给 React 调用的方法</span>
  <span class="nx">appendElement</span> <span class="p">(</span><span class="nx">element</span><span class="p">)</span> <span class="p">{</span>
    <span class="k">this</span><span class="p">.</span><span class="nx">synced</span> <span class="o">=</span> <span class="kc">false</span>
    <span class="k">this</span><span class="p">.</span><span class="nx">elements</span><span class="p">.</span><span class="nx">push</span><span class="p">(</span><span class="nx">element</span><span class="p">)</span>
  <span class="p">}</span>
  <span class="c1">// 交给 React 调用的方法</span>
  <span class="nx">removeElement</span> <span class="p">(</span><span class="nx">element</span><span class="p">)</span> <span class="p">{</span>
    <span class="k">this</span><span class="p">.</span><span class="nx">synced</span> <span class="o">=</span> <span class="kc">false</span>
    <span class="kr">const</span> <span class="nx">i</span> <span class="o">=</span> <span class="k">this</span><span class="p">.</span><span class="nx">elements</span><span class="p">.</span><span class="nx">indexOf</span><span class="p">(</span><span class="nx">element</span><span class="p">)</span>
    <span class="k">if</span> <span class="p">(</span><span class="nx">i</span> <span class="o">!==</span> <span class="o">-</span><span class="mi">1</span><span class="p">)</span> <span class="k">this</span><span class="p">.</span><span class="nx">elements</span><span class="p">.</span><span class="nx">splice</span><span class="p">(</span><span class="nx">i</span><span class="p">,</span> <span class="mi">1</span><span class="p">)</span>
  <span class="p">}</span>
  <span class="c1">// 每帧执行，但仅当状态更改时重新 render</span>
  <span class="nx">onFrameTick</span> <span class="p">()</span> <span class="p">{</span>
    <span class="k">if</span> <span class="p">(</span><span class="o">!</span><span class="k">this</span><span class="p">.</span><span class="nx">synced</span><span class="p">)</span> <span class="k">this</span><span class="p">.</span><span class="nx">render</span><span class="p">()</span>
    <span class="k">this</span><span class="p">.</span><span class="nx">synced</span> <span class="o">=</span> <span class="kc">true</span>
  <span class="p">}</span>
  <span class="c1">// 清屏后绘制各类元素</span>
  <span class="nx">render</span> <span class="p">()</span> <span class="p">{</span>
    <span class="nx">clear</span><span class="p">()</span>
    <span class="k">for</span> <span class="p">(</span><span class="kd">let</span> <span class="nx">i</span> <span class="o">=</span> <span class="mi">0</span><span class="p">;</span> <span class="nx">i</span> <span class="o">&lt;</span> <span class="k">this</span><span class="p">.</span><span class="nx">elements</span><span class="p">.</span><span class="nx">length</span><span class="p">;</span> <span class="nx">i</span><span class="o">++</span><span class="p">)</span> <span class="p">{</span>
      <span class="kr">const</span> <span class="nx">element</span> <span class="o">=</span> <span class="k">this</span><span class="p">.</span><span class="nx">elements</span><span class="p">[</span><span class="nx">i</span><span class="p">]</span>
      <span class="k">if</span> <span class="p">(</span><span class="nx">element</span> <span class="k">instanceof</span> <span class="nx">NativeTextElement</span><span class="p">)</span> <span class="p">{</span>
        <span class="kr">const</span> <span class="p">{</span> <span class="nx">children</span><span class="p">,</span> <span class="nx">row</span><span class="p">,</span> <span class="nx">col</span> <span class="p">}</span> <span class="o">=</span> <span class="nx">element</span><span class="p">.</span><span class="nx">props</span>
        <span class="nx">drawText</span><span class="p">(</span><span class="nx">children</span><span class="p">[</span><span class="mi">0</span><span class="p">],</span> <span class="nx">row</span><span class="p">,</span> <span class="nx">col</span><span class="p">)</span>
      <span class="p">}</span> <span class="k">else</span> <span class="k">if</span> <span class="p">(</span><span class="nx">element</span> <span class="k">instanceof</span> <span class="nx">NativePixelElement</span><span class="p">)</span> <span class="p">{</span>
        <span class="nx">drawPixel</span><span class="p">(</span><span class="nx">element</span><span class="p">.</span><span class="nx">props</span><span class="p">.</span><span class="nx">x</span><span class="p">,</span> <span class="nx">element</span><span class="p">.</span><span class="nx">props</span><span class="p">.</span><span class="nx">y</span><span class="p">)</span>
      <span class="p">}</span>
    <span class="p">}</span>
  <span class="p">}</span>
<span class="p">}</span>
</code></pre></div><p>不难看出这个 NativeContainer 只要内部元素被更改，就会在下一帧调用 C 渲染模块。那么该如何让 React 调用它的方法呢？这就需要上面的 <code>hostConfig</code> 配置了。这份配置中需要实现大量的  Reconciler API。对于我们最简单的初次渲染场景而言，包括这些：</p><div class="highlight"><pre><code class="language-js"><span></span><span class="nx">appendInitialChild</span> <span class="p">()</span> <span class="p">{}</span>
<span class="nx">appendChildToContainer</span>  <span class="p">()</span> <span class="p">{}</span> <span class="c1">// 关键</span>
<span class="nx">appendChild</span> <span class="p">()</span> <span class="p">{}</span>
<span class="nx">createInstance</span> <span class="p">()</span> <span class="p">{}</span> <span class="c1">// 关键</span>
<span class="nx">createTextInstance</span> <span class="p">()</span> <span class="p">{}</span>
<span class="nx">finalizeInitialChildren</span> <span class="p">()</span> <span class="p">{}</span>
<span class="nx">getPublicInstance</span> <span class="p">()</span> <span class="p">{}</span>
<span class="nx">now</span> <span class="p">()</span> <span class="p">{}</span>
<span class="nx">prepareForCommit</span> <span class="p">()</span> <span class="p">{}</span>
<span class="nx">prepareUpdate</span> <span class="p">()</span> <span class="p">{}</span>
<span class="nx">resetAfterCommit</span> <span class="p">()</span> <span class="p">{}</span>
<span class="nx">resetTextContent</span> <span class="p">()</span> <span class="p">{}</span>
<span class="nx">getRootHostContext</span> <span class="p">()</span> <span class="p">{}</span> <span class="c1">// 关键</span>
<span class="nx">getChildHostContext</span> <span class="p">()</span> <span class="p">{}</span>
<span class="nx">shouldSetTextContent</span> <span class="p">()</span> <span class="p">{}</span>
<span class="nx">useSyncScheduling</span><span class="o">:</span> <span class="kc">true</span>
<span class="nx">supportsMutation</span><span class="o">:</span> <span class="kc">true</span>
</code></pre></div><p>这里真正有意义的实现基本都在标记为「关键」的项里。例如，假设我的 NativeContainer 中具备 NativeText 和 NativePixel 两种元素，那么 <code>createInstance</code> 勾子里就应该根据 React 组件的 type 来创建相应的元素实例，并在 <code>appendChildToContainer</code> 勾子里将这些实例添加到 NativeContainer 中。具体实现相当简单，可以参考实际代码。</p><p>创建之后，我们还有更新和删除元素的可能。这至少对应于这些 Reconciler API：</p><div class="highlight"><pre><code class="language-js"><span></span><span class="nx">commitTextUpdate</span> <span class="p">()</span> <span class="p">{}</span>
<span class="nx">commitUpdate</span> <span class="p">()</span> <span class="p">{}</span> <span class="c1">// 关键</span>
<span class="nx">removeChildFromContainer</span> <span class="p">()</span> <span class="p">{}</span> <span class="c1">// 关键</span>
</code></pre></div><p>它们的实现也是同理的。最后，我们需要跟 Renderer 打包提供一些「内置组件」，就像这样：</p><div class="highlight"><pre><code class="language-js"><span></span><span class="kr">export</span> <span class="kr">const</span> <span class="nx">Text</span> <span class="o">=</span> <span class="s1">'TEXT'</span>
<span class="kr">export</span> <span class="kr">const</span> <span class="nx">Pixel</span> <span class="o">=</span> <span class="s1">'PIXEL'</span>
<span class="c1">// ...</span>
<span class="kr">export</span> <span class="kr">const</span> <span class="nx">SSD1306Renderer</span> <span class="o">=</span> <span class="p">{</span>
  <span class="nx">render</span> <span class="p">()</span> <span class="p">{</span> <span class="cm">/* ... */</span> <span class="p">}</span>
<span class="p">}</span>
</code></pre></div><p>这样我们从 Reconciler 那里拿到的组件 type 就可以是这些常量，进而告知 NativeContainer 更新啦。</p><p><b>到此为止，经过这全部的历程后，我们终于能用 React 直接控制屏幕了</b>！这个 Renderer 实现后，基于它的代码就相当简单了：</p><div class="highlight"><pre><code class="language-js"><span></span><span class="kr">import</span> <span class="s1">'./polyfill.js'</span>
<span class="kr">import</span> <span class="nx">React</span> <span class="nx">from</span> <span class="s1">'react'</span>
<span class="kr">import</span> <span class="p">{</span> <span class="nx">SSD1306Renderer</span><span class="p">,</span> <span class="nx">Text</span><span class="p">,</span> <span class="nx">Pixel</span> <span class="p">}</span> <span class="nx">from</span> <span class="s1">'./renderer.js'</span>

<span class="kr">class</span> <span class="nx">App</span> <span class="kr">extends</span> <span class="nx">React</span><span class="p">.</span><span class="nx">Component</span> <span class="p">{</span>
  <span class="nx">constructor</span> <span class="p">()</span> <span class="p">{</span>
    <span class="kr">super</span><span class="p">()</span>
    <span class="k">this</span><span class="p">.</span><span class="nx">state</span> <span class="o">=</span> <span class="p">{</span> <span class="nx">hello</span><span class="o">:</span> <span class="s1">'Hello React!'</span><span class="p">,</span> <span class="nx">p</span><span class="o">:</span> <span class="mi">0</span> <span class="p">}</span>
  <span class="p">}</span>

  <span class="nx">render</span> <span class="p">()</span> <span class="p">{</span>
    <span class="kr">const</span> <span class="p">{</span> <span class="nx">hello</span><span class="p">,</span> <span class="nx">p</span> <span class="p">}</span> <span class="o">=</span> <span class="k">this</span><span class="p">.</span><span class="nx">state</span>
    <span class="k">return</span> <span class="p">(</span>
      <span class="o">&lt;</span><span class="nx">React</span><span class="p">.</span><span class="nx">Fragment</span><span class="o">&gt;</span>
        <span class="o">&lt;</span><span class="nx">Text</span> <span class="nx">row</span><span class="o">=</span><span class="p">{</span><span class="mi">0</span><span class="p">}</span> <span class="nx">col</span><span class="o">=</span><span class="p">{</span><span class="mi">0</span><span class="p">}</span><span class="o">&gt;</span><span class="p">{</span><span class="nx">hello</span><span class="p">}</span><span class="o">&lt;</span><span class="err">/Text&gt;</span>
        <span class="o">&lt;</span><span class="nx">Text</span> <span class="nx">row</span><span class="o">=</span><span class="p">{</span><span class="mi">1</span><span class="p">}</span> <span class="nx">col</span><span class="o">=</span><span class="p">{</span><span class="mi">0</span><span class="p">}</span><span class="o">&gt;</span><span class="nx">Hello</span> <span class="nx">QuickJS</span><span class="o">!&lt;</span><span class="err">/Text&gt;</span>
        <span class="o">&lt;</span><span class="nx">Pixel</span> <span class="nx">x</span><span class="o">=</span><span class="p">{</span><span class="nx">p</span><span class="p">}</span> <span class="nx">y</span><span class="o">=</span><span class="p">{</span><span class="nx">p</span><span class="p">}</span> <span class="o">/&gt;</span>
      <span class="o">&lt;</span><span class="err">/React.Fragment&gt;</span>
    <span class="p">)</span>
  <span class="p">}</span>

  <span class="nx">componentDidMount</span> <span class="p">()</span> <span class="p">{</span>
    <span class="c1">// XXX: 模拟事件驱动更新</span>
    <span class="nx">setTimeout</span><span class="p">(()</span> <span class="p">=&gt;</span> <span class="k">this</span><span class="p">.</span><span class="nx">setState</span><span class="p">({</span> <span class="nx">hello</span><span class="o">:</span> <span class="s1">'Hello Pi!'</span><span class="p">,</span> <span class="nx">p</span><span class="o">:</span> <span class="mi">42</span> <span class="p">}),</span> <span class="mi">2000</span><span class="p">)</span>
    <span class="nx">setTimeout</span><span class="p">(()</span> <span class="p">=&gt;</span> <span class="k">this</span><span class="p">.</span><span class="nx">setState</span><span class="p">({</span> <span class="nx">hello</span><span class="o">:</span> <span class="s1">''</span><span class="p">,</span> <span class="nx">p</span><span class="o">:</span> <span class="o">-</span><span class="mi">1</span> <span class="p">}),</span> <span class="mi">4000</span><span class="p">)</span>
  <span class="p">}</span>
<span class="p">}</span>

<span class="nx">SSD1306Renderer</span><span class="p">.</span><span class="nx">render</span><span class="p">(</span><span class="o">&lt;</span><span class="nx">App</span> <span class="o">/&gt;</span><span class="p">)</span>
</code></pre></div><p>渲染结果是这样的：</p><figure data-size="normal"><img src="https://pic4.zhimg.com/v2-fedc87dd0c88459034656118cbf1713b_b.jpg" data-caption="" data-size="normal" data-rawwidth="1500" data-rawheight="1125" class="origin_image zh-lightbox-thumb" width="1500" data-original="https://pic4.zhimg.com/v2-fedc87dd0c88459034656118cbf1713b_r.jpg"></figure><p>别看显示效果似乎貌不惊人，这几行文字的出现，标准着 JSX、组件生命周期勾子和潜在的 Hooks / Redux 等现代的前端技术，终于都能直通嵌入式硬件啦——将 React、QuickJS、树莓派和液晶屏连接起来的尝试，到此也算是能告一段落了。拜 QuickJS 所赐，<b>最终包括 JS 引擎和 React 全家桶在内的整个二进制可执行文件体积，只有 780K 左右</b>。</p><h2>资源</h2><p>上面涉及的整个项目代码示例，都在公开的 <a href="http://link.zhihu.com/?target=https%3A//github.com/doodlewind/react-ssd1306" class=" wrap external" target="_blank" rel="nofollow noreferrer">react-ssd1306</a> 仓库中（如果你觉得有意思，来个 star 吧）。再附上些过程中较有帮助的参考链接：</p><ul><li><a href="http://link.zhihu.com/?target=https%3A//bellard.org/quickjs" class=" wrap external" target="_blank" rel="nofollow noreferrer">QuickJS 主页</a></li><li><a href="http://link.zhihu.com/?target=https%3A//medium.com/%40calbertts/how-to-create-asynchronous-apis-for-quickjs-8aca5488bb2e" class=" wrap external" target="_blank" rel="nofollow noreferrer">QuickJS 异步原生模块开发</a></li><li><a href="http://link.zhihu.com/?target=https%3A//www.raspberrypi-spy.co.uk/2018/04/i2c-oled-display-module-with-raspberry-pi/" class=" wrap external" target="_blank" rel="nofollow noreferrer">在树莓派上使用 I2C OLED</a></li><li><a href="http://link.zhihu.com/?target=https%3A//github.com/nitin42/Making-a-custom-React-renderer" class=" wrap external" target="_blank" rel="nofollow noreferrer">构建自定义 React Renderer</a></li></ul><h2>后记</h2><p>如果你坚持到了这里，那真是辛苦你啦~这篇文章的篇幅相当长，涉及的关键点也可能比较分散——重点到底是如何使用 QuickJS、如何编写 C 扩展，还是如何定制 React Reconciler 呢？似乎都很重要啊（笑）。不过这个过程折腾下来，确实给了我很多收获。许多以前只是听说过，或者觉得非常高大上的概念，自己动手做过之后才发现并没有那么遥不可及。其他的一些感想大概还有：</p><ul><li>有了这么方便的嵌入式 JS 引擎，Web 技术栈可以更好地走出浏览器啦</li><li>树莓派真的很有趣，配合 VSCode Remote 更是高效。非常推荐入手玩玩</li><li>I2C 的性能瓶颈真的很明显，整个系统的优化光在 React 侧做肯定还不够</li><li>运行 React 的「最低配置」是多少呢？一定比 Node.js 的最低配置低得多吧</li></ul><p>其实从我日常切图的时候起，我就喜欢弄些「对业务没什么直接价值」的东西，比如：</p><ul><li><a href="http://link.zhihu.com/?target=http%3A//ewind.us/h5/ove-lang/demo/" class=" wrap external" target="_blank" rel="nofollow noreferrer">支持中文关键字的类 Lisp 语言解释器</a></li><li><a href="http://link.zhihu.com/?target=https%3A//juejin.im/post/5b837c0b51882542d950efb4" class=" wrap external" target="_blank" rel="nofollow noreferrer">用 WebGL 渲染魔方，并写算法还原它</a></li><li><a href="http://link.zhihu.com/?target=https%3A//juejin.im/post/5a11729251882554b83723e5" class=" wrap external" target="_blank" rel="nofollow noreferrer">能玩 PONG 游戏的 Chip8 虚拟机</a></li></ul><p>这次的 react-ssd1306 项目里，驱使我的动力和造这些轮子时也是相似的。为什么不好好写业务逻辑，非要搞这些「没有意义」的事呢？</p><p><b>Because we can.</b></p><blockquote>我主要是个前端开发者。如果你对 Web 结构化数据编辑、WebGL 渲染、Hybrid 应用开发，或者计算机爱好者的碎碎念感兴趣，欢迎关注这个专栏噢 :)</blockquote>