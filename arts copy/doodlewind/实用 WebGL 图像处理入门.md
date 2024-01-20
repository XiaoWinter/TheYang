<p>技术社区里有种很有意思的现象，那就是不少人们口耳相传中的强大技术，往往因为上手难度高而显得曲高和寡。从这个角度看来，WebGL 和函数式编程有些类似，都属于优势已被论证了多年，却一直较为不温不火的技术。但是，一旦这些技术的易用性跨越了某个临界点，它们其实并没有那么遥不可及。这次我们就将以 WebGL 为例，尝试降低它的入门门槛，讲解它在前端图像处理领域的应用入门。</p><p>临近 2020 年的今天，社区里已经有了许多 WebGL 教程。为什么还要另起炉灶再写一篇呢？这来自于笔者供职的稿定科技前端团队，在 WebGL 基础库层面进行技术创新的努力。前一段时间，我们开源了自主研发的 WebGL 基础库 Beam。它以 10KB 不到的体积，将传统上入门时动辄几百行的 WebGL 渲染逻辑降低到了几十行的量级，并在性能上也毫不妥协。开源两周内，Beam 的 Star 数量就达到了 GitHub 全站 WebGL Library 搜索条目下的前 10%，在国内也还没有定位相当的竞品。<b>这次我们将借助 Beam 来编写 WebGL 渲染逻辑</b>，用精炼的代码和概念告诉大家，该如何硬核而不失优雅地手动操控 GPU 渲染管线，实现多样的前端图像处理能力。</p><p>本文将覆盖的内容如下所示。我们希望能带着感兴趣的同学从零基础入门，直通具备实用价值的图像滤镜能力开发：</p><ul><li>WebGL 概念入门</li><li>WebGL 示例入门</li><li>如何用 WebGL 渲染图像</li><li>如何为图像增加滤镜</li><li>如何叠加多个图像</li><li>如何组合多个滤镜</li><li>如何引入 3D 效果</li><li>如何封装自定渲染器</li></ul><blockquote> 为了照顾没有基础的同学，在进入实际的图像处理部分前，我们会重新用 Beam 入门一遍 WebGL。熟悉相关概念的同学可以直接跳过这些部分。</blockquote><h2>WebGL 概念入门</h2><p>Beam 的一个设计目标，是让使用者<b>即便没有相关经验，也能靠它快速搞懂 WebGL</b>。但这并不意味着它像 Three.js 那样可以几乎完全不用懂图形学，拿来就是一把梭。相比之下，Beam 选择对 WebGL 概念做高度的抽象。在学习理解这些概念后，你就不仅能理解 GPU 渲染管线，还能用简单的代码来操作它了。毕竟这篇文章本身，也是本着授人以渔的理念来写作的。</p><blockquote> 本节来自 <a href="https://zhuanlan.zhihu.com/p/93500639" class="internal">如何设计一个 WebGL 基础库</a> 一文，熟悉的同学可跳过。</blockquote><p>WebGL 体系有很多琐碎之处，一头扎进代码里，容易使我们只见树木不见森林。然而我们真正需要关心的概念，其实可以被高度浓缩为这几个：</p><ul><li><b>Shader</b> 着色器，<b>是存放图形算法的对象</b>。 相比于在 CPU 上单线程执行的 JS 代码，着色器在 GPU 上并行执行，计算出每帧数百万个像素各自的颜色。</li><li><b>Resource</b> 资源，<b>是存放图形数据的对象</b>。就像 JSON 成为 Web App 的数据那样，资源是传递给着色器的数据，包括大段的顶点数组、纹理图像，以及全局的配置项等。</li><li><b>Draw</b> 绘制，<b>是选好资源后运行着色器的请求</b>。要想渲染真实际的场景，一般需要多组着色器与多个资源，来回绘制多次才能完成一帧。每次绘制前，我们都需要选好着色器，并为其关联好不同的资源，也都会启动一次图形渲染管线。</li><li><b>Command</b> 命令，<b>是执行绘制前的配置</b>。WebGL 是非常有状态的。每次绘制前，我们都必须小心地处理好状态机。这些状态变更就是通过命令来实现的。Beam 基于一些约定大幅简化了人工的命令管理，当然你也可以定制自己的命令。</li></ul><p>这些概念是如何协同工作的呢？请看下图：</p><figure data-size="normal"><img src="https://pic1.zhimg.com/v2-a15548e0ad3af543aa89ead4dd17b130_b.jpg" data-caption="" data-size="normal" data-rawwidth="1920" data-rawheight="1080" class="origin_image zh-lightbox-thumb" width="1920" data-original="https://pic1.zhimg.com/v2-a15548e0ad3af543aa89ead4dd17b130_r.jpg"></figure><p>图中的 Buffers / Textures / Uniforms 都属于典型的资源（后面会详述它们各自的用途）。一帧当中可能存在多次绘制，每次绘制都需要着色器和相应的资源。在绘制之间，我们通过命令来管理好 WebGL 的状态。仅此而已。</p><p>理解这个思维模型很重要。因为 Beam 的 API 设计就是完全依据这个模型而实现的。让我们进一步看看一个实际的场景吧：</p><figure data-size="normal"><img src="https://pic1.zhimg.com/v2-205a79081571b33dc3f95ca73d9481a8_b.jpg" data-caption="" data-size="normal" data-rawwidth="228" data-rawheight="198" class="content_image" width="228"></figure><p>图中我们绘制了很多质感不同的球体。这一帧的渲染，则可以这样解构到上面的这些概念下：</p><ul><li><b>着色器</b>无疑就是球体质感的<b>渲染算法</b>。对经典的 3D 游戏来说，要渲染不同质感的物体，经常需要切换不同的着色器。但现在基于物理的渲染算法流行后，这些球体也不难做到使用同一个着色器来渲染。</li><li><b>资源</b>包括了大段的球体<b>顶点数据</b>、材质纹理的<b>图像数据</b>，以及光照参数、变换矩阵等<b>配置项</b>。</li><li><b>绘制</b>是分多次进行的。我们选择<b>每次绘制一个球体</b>，而每次绘制也都会启动一次图形渲染管线。</li><li><b>命令</b>则是相邻的球体绘制之间，所执行的那些<b>状态变更</b>。</li></ul><p>如何理解状态变更呢？不妨将 WebGL 想象成一个具备大量开关与接口的仪器。每次按下启动键（执行绘制）前。你都要配置好一堆开关，再连接好一条接着色器的线，和一堆接资源的线，就像这样：</p><figure data-size="normal"><img src="https://pic2.zhimg.com/v2-7f08dece8605e45cece7d2d1b4d64019_b.jpg" data-caption="" data-size="normal" data-rawwidth="1920" data-rawheight="1080" class="origin_image zh-lightbox-thumb" width="1920" data-original="https://pic2.zhimg.com/v2-7f08dece8605e45cece7d2d1b4d64019_r.jpg"></figure><p>还有很重要的一点，那就是虽然我们已经知道，一帧画面可以通过多次绘制而生成，而每次绘制又对应执行一次图形渲染管线的执行。但是，所谓的图形渲染管线又是什么呢？这对应于这张图：</p><figure data-size="normal"><img src="https://pic2.zhimg.com/v2-9beb7852fa6720ed9eaa74551629e719_b.jpg" data-caption="" data-size="normal" data-rawwidth="1920" data-rawheight="1080" class="origin_image zh-lightbox-thumb" width="1920" data-original="https://pic2.zhimg.com/v2-9beb7852fa6720ed9eaa74551629e719_r.jpg"></figure><p>渲染管线，一般指的就是这样一个 GPU 上由顶点数据到像素的过程。对现代 GPU 来说，管线中的某些阶段是可编程的。WebGL 标准里，这对应于图中蓝色的顶点着色器和片元着色器阶段。你可以把它们想象成<b>两个需要你写 C-style 代码，跑在 GPU 上的函数</b>。它们大体上分别做这样的工作：</p><ul><li><b>顶点着色器</b>输入原始的顶点坐标，输出经过你计算出的坐标。</li><li><b>片元着色器</b>输入一个像素位置，输出根据你计算出的像素颜色。</li></ul><p>下面，我们将进一步讲解如何应用这些概念，搭建出一个完整的 WebGL 入门示例。</p><h2>WebGL 示例入门</h2><blockquote> 本节同样来自 <a href="https://zhuanlan.zhihu.com/p/93500639" class="internal">如何设计一个 WebGL 基础库</a> 一文，但为承接后续的图像处理内容，叙述有所调整。</blockquote><p>在苦口婆心的概念介绍后，就要来到真刀真枪的编码阶段了。由于四大概念中的命令可以被自动化，我们只为 Beam 定义了三个核心 API，分别是：</p><ul><li><b>beam.shader</b></li><li><b>beam.resource</b></li><li><b>beam.draw</b></li></ul><p>显然地，它们各自管理着色器、资源和绘制。让我们看看怎样基于 Beam，来绘制 WebGL 中的 Hello World 彩色三角形吧：</p><figure data-size="normal"><img src="https://pic1.zhimg.com/v2-d9d1f9da5dfb81a0565a8ad679f6b010_b.jpg" data-caption="" data-size="normal" data-rawwidth="200" data-rawheight="200" class="content_image" width="200"></figure><p>三角形是最简单的多边形，而多边形则是由顶点组成的。WebGL 中的这些顶点是有序排列，可通过下标索引的。以三角形和矩形为例，这里使用的顶点顺序如下所示：</p><figure data-size="normal"><img src="https://pic3.zhimg.com/v2-da360d2f34af91f8c372234d7e4faed6_b.jpg" data-caption="" data-size="normal" data-rawwidth="1920" data-rawheight="1080" class="origin_image zh-lightbox-thumb" width="1920" data-original="https://pic3.zhimg.com/v2-da360d2f34af91f8c372234d7e4faed6_r.jpg"></figure><p>Beam 的代码示例如下，压缩后<b>全部代码体积仅有 6KB</b>：</p><div class="highlight"><pre><code class="language-js"><span></span><span class="kr">import</span> <span class="p">{</span> <span class="nx">Beam</span><span class="p">,</span> <span class="nx">ResourceTypes</span> <span class="p">}</span> <span class="nx">from</span> <span class="s1">'beam-gl'</span>
<span class="kr">import</span> <span class="p">{</span> <span class="nx">MyShader</span> <span class="p">}</span> <span class="nx">from</span> <span class="s1">'./my-shader.js'</span>
<span class="kr">const</span> <span class="p">{</span> <span class="nx">VertexBuffers</span><span class="p">,</span> <span class="nx">IndexBuffer</span> <span class="p">}</span> <span class="o">=</span> <span class="nx">ResourceTypes</span>

<span class="kr">const</span> <span class="nx">canvas</span> <span class="o">=</span> <span class="nb">document</span><span class="p">.</span><span class="nx">querySelector</span><span class="p">(</span><span class="s1">'canvas'</span><span class="p">)</span>
<span class="kr">const</span> <span class="nx">beam</span> <span class="o">=</span> <span class="k">new</span> <span class="nx">Beam</span><span class="p">(</span><span class="nx">canvas</span><span class="p">)</span>

<span class="kr">const</span> <span class="nx">shader</span> <span class="o">=</span> <span class="nx">beam</span><span class="p">.</span><span class="nx">shader</span><span class="p">(</span><span class="nx">MyShader</span><span class="p">)</span>
<span class="kr">const</span> <span class="nx">vertexBuffers</span> <span class="o">=</span> <span class="nx">beam</span><span class="p">.</span><span class="nx">resource</span><span class="p">(</span><span class="nx">VertexBuffers</span><span class="p">,</span> <span class="p">{</span>
  <span class="nx">position</span><span class="o">:</span> <span class="p">[</span>
    <span class="o">-</span><span class="mi">1</span><span class="p">,</span> <span class="o">-</span><span class="mi">1</span><span class="p">,</span> <span class="mi">0</span><span class="p">,</span> <span class="c1">// vertex 0 左下角</span>
    <span class="mi">0</span><span class="p">,</span> <span class="mi">1</span><span class="p">,</span> <span class="mi">0</span><span class="p">,</span> <span class="c1">// vertex 1 顶部</span>
    <span class="mi">1</span><span class="p">,</span> <span class="o">-</span><span class="mi">1</span><span class="p">,</span> <span class="mi">0</span> <span class="c1">// vertex 2 右下角</span>
  <span class="p">],</span>
  <span class="nx">color</span><span class="o">:</span> <span class="p">[</span>
    <span class="mi">1</span><span class="p">,</span> <span class="mi">0</span><span class="p">,</span> <span class="mi">0</span><span class="p">,</span> <span class="c1">// vertex 0 红色</span>
    <span class="mi">0</span><span class="p">,</span> <span class="mi">1</span><span class="p">,</span> <span class="mi">0</span><span class="p">,</span> <span class="c1">// vertex 1 绿色</span>
    <span class="mi">0</span><span class="p">,</span> <span class="mi">0</span><span class="p">,</span> <span class="mi">1</span> <span class="c1">// vertex 2 蓝色</span>
  <span class="p">]</span>
<span class="p">})</span>
<span class="kr">const</span> <span class="nx">indexBuffer</span> <span class="o">=</span> <span class="nx">beam</span><span class="p">.</span><span class="nx">resource</span><span class="p">(</span><span class="nx">IndexBuffer</span><span class="p">,</span> <span class="p">{</span>
  <span class="nx">array</span><span class="o">:</span> <span class="p">[</span><span class="mi">0</span><span class="p">,</span> <span class="mi">1</span><span class="p">,</span> <span class="mi">2</span><span class="p">]</span> <span class="c1">// 由 0 1 2 号顶点组成的三角形</span>
<span class="p">})</span>

<span class="nx">beam</span>
  <span class="p">.</span><span class="nx">clear</span><span class="p">()</span>
  <span class="p">.</span><span class="nx">draw</span><span class="p">(</span><span class="nx">shader</span><span class="p">,</span> <span class="nx">vertexBuffers</span><span class="p">,</span> <span class="nx">indexBuffer</span><span class="p">)</span>
</code></pre></div><p>下面逐个介绍一些重要的 API 片段。首先自然是初始化 Beam 了：</p><div class="highlight"><pre><code class="language-js"><span></span><span class="kr">const</span> <span class="nx">canvas</span> <span class="o">=</span> <span class="nb">document</span><span class="p">.</span><span class="nx">querySelector</span><span class="p">(</span><span class="s1">'canvas'</span><span class="p">)</span>
<span class="kr">const</span> <span class="nx">beam</span> <span class="o">=</span> <span class="k">new</span> <span class="nx">Beam</span><span class="p">(</span><span class="nx">canvas</span><span class="p">)</span>
</code></pre></div><p>然后我们用 <code>beam.shader</code> 来实例化着色器，这里的 <code>MyShader</code> 稍后再说：</p><div class="highlight"><pre><code class="language-js"><span></span><span class="kr">const</span> <span class="nx">shader</span> <span class="o">=</span> <span class="nx">beam</span><span class="p">.</span><span class="nx">shader</span><span class="p">(</span><span class="nx">MyShader</span><span class="p">)</span>
</code></pre></div><p>着色器准备好之后，就是准备资源了。为此我们需要使用 <code>beam.resource</code> API 来创建三角形的数据。这些数据装在不同的 Buffer 里，而 Beam 使用 <code>VertexBuffers</code> 类型来表达它们。三角形有 3 个顶点，每个顶点有两个属性 (attribute)，即 <b>position</b> 和 <b>color</b>，每个属性都对应于一个独立的 Buffer。这样我们就不难用普通的 JS 数组（或 TypedArray）来声明这些顶点数据了。Beam 会替你将它们上传到 GPU：</p><blockquote> 注意区分 WebGL 中的<b>顶点</b>和<b>坐标</b>概念。顶点 (vertex) 不仅可以包含一个点的坐标属性，还可以包含法向量、颜色等其它属性。这些属性都可以输入顶点着色器中来做计算。 </blockquote><div class="highlight"><pre><code class="language-js"><span></span><span class="kr">const</span> <span class="nx">vertexBuffers</span> <span class="o">=</span> <span class="nx">beam</span><span class="p">.</span><span class="nx">resource</span><span class="p">(</span><span class="nx">VertexBuffers</span><span class="p">,</span> <span class="p">{</span>
  <span class="nx">position</span><span class="o">:</span> <span class="p">[</span>
    <span class="o">-</span><span class="mi">1</span><span class="p">,</span> <span class="o">-</span><span class="mi">1</span><span class="p">,</span> <span class="mi">0</span><span class="p">,</span> <span class="c1">// vertex 0 左下角</span>
    <span class="mi">0</span><span class="p">,</span> <span class="mi">1</span><span class="p">,</span> <span class="mi">0</span><span class="p">,</span> <span class="c1">// vertex 1 顶部</span>
    <span class="mi">1</span><span class="p">,</span> <span class="o">-</span><span class="mi">1</span><span class="p">,</span> <span class="mi">0</span> <span class="c1">// vertex 2 右下角</span>
  <span class="p">],</span>
  <span class="nx">color</span><span class="o">:</span> <span class="p">[</span>
    <span class="mi">1</span><span class="p">,</span> <span class="mi">0</span><span class="p">,</span> <span class="mi">0</span><span class="p">,</span> <span class="c1">// vertex 0 红色</span>
    <span class="mi">0</span><span class="p">,</span> <span class="mi">1</span><span class="p">,</span> <span class="mi">0</span><span class="p">,</span> <span class="c1">// vertex 1 绿色</span>
    <span class="mi">0</span><span class="p">,</span> <span class="mi">0</span><span class="p">,</span> <span class="mi">1</span> <span class="c1">// vertex 2 蓝色</span>
  <span class="p">]</span>
<span class="p">})</span>
</code></pre></div><p>装顶点的 Buffer 通常会使用很紧凑的数据集。我们可以定义这份数据的一个子集或者超集来用于实际渲染，以便于减少数据冗余并复用更多顶点。为此我们需要引入 WebGL 中的 <code>IndexBuffer</code> 概念，它指定了渲染时用到的顶点下标。这个例子里，0 1 2 这样的每个下标，都对应顶点数组里的 3 个位置：</p><div class="highlight"><pre><code class="language-js"><span></span><span class="kr">const</span> <span class="nx">indexBuffer</span> <span class="o">=</span> <span class="nx">beam</span><span class="p">.</span><span class="nx">resource</span><span class="p">(</span><span class="nx">IndexBuffer</span><span class="p">,</span> <span class="p">{</span>
  <span class="nx">array</span><span class="o">:</span> <span class="p">[</span><span class="mi">0</span><span class="p">,</span> <span class="mi">1</span><span class="p">,</span> <span class="mi">2</span><span class="p">]</span> <span class="c1">// 由 0 1 2 号顶点组成的三角形</span>
<span class="p">})</span>
</code></pre></div><p>最后我们就可以进入渲染环节啦。首先用 <code>beam.clear</code> 来清空当前帧，然后为 <code>beam.draw</code> 传入<b>一个着色器对象和任意多个资源对象</b>即可：</p><div class="highlight"><pre><code class="language-js"><span></span><span class="nx">beam</span>
  <span class="p">.</span><span class="nx">clear</span><span class="p">()</span>
  <span class="p">.</span><span class="nx">draw</span><span class="p">(</span><span class="nx">shader</span><span class="p">,</span> <span class="nx">vertexBuffers</span><span class="p">,</span> <span class="nx">indexBuffer</span><span class="p">)</span>
</code></pre></div><p>我们的 <code>beam.draw</code> API 是非常灵活的。如果你有多个着色器和多个资源，可以随意组合它们来链式地完成绘制，渲染出复杂的场景。就像这样：</p><div class="highlight"><pre><code class="language-js"><span></span><span class="nx">beam</span>
  <span class="p">.</span><span class="nx">draw</span><span class="p">(</span><span class="nx">shaderX</span><span class="p">,</span> <span class="p">...</span><span class="nx">resourcesA</span><span class="p">)</span>
  <span class="p">.</span><span class="nx">draw</span><span class="p">(</span><span class="nx">shaderY</span><span class="p">,</span> <span class="p">...</span><span class="nx">resourcesB</span><span class="p">)</span>
  <span class="p">.</span><span class="nx">draw</span><span class="p">(</span><span class="nx">shaderZ</span><span class="p">,</span> <span class="p">...</span><span class="nx">resourcesC</span><span class="p">)</span>
</code></pre></div><p>别忘了还有个遗漏的地方：如何决定三角形的渲染算法呢？这是在 <code>MyShader</code> 变量里指定的。它其实是个着色器的 Schema，像这样：</p><div class="highlight"><pre><code class="language-js"><span></span><span class="kr">import</span> <span class="p">{</span> <span class="nx">SchemaTypes</span> <span class="p">}</span> <span class="nx">from</span> <span class="s1">'beam-gl'</span>

<span class="kr">const</span> <span class="nx">vertexShader</span> <span class="o">=</span> <span class="sb">`</span>
<span class="sb">attribute vec4 position;</span>
<span class="sb">attribute vec4 color;</span>
<span class="sb">varying highp vec4 vColor;</span>
<span class="sb">void main() {</span>
<span class="sb">  vColor = color;</span>
<span class="sb">  gl_Position = position;</span>
<span class="sb">}</span>
<span class="sb">`</span>
<span class="kr">const</span> <span class="nx">fragmentShader</span> <span class="o">=</span> <span class="sb">`</span>
<span class="sb">varying highp vec4 vColor;</span>
<span class="sb">void main() {</span>
<span class="sb">  gl_FragColor = vColor;</span>
<span class="sb">}</span>
<span class="sb">`</span>

<span class="kr">const</span> <span class="p">{</span> <span class="nx">vec4</span> <span class="p">}</span> <span class="o">=</span> <span class="nx">SchemaTypes</span>
<span class="kr">export</span> <span class="kr">const</span> <span class="nx">MyShader</span> <span class="o">=</span> <span class="p">{</span>
  <span class="nx">vs</span><span class="o">:</span> <span class="nx">vertexShader</span><span class="p">,</span>
  <span class="nx">fs</span><span class="o">:</span> <span class="nx">fragmentShader</span><span class="p">,</span>
  <span class="nx">buffers</span><span class="o">:</span> <span class="p">{</span>
    <span class="nx">position</span><span class="o">:</span> <span class="p">{</span> <span class="nx">type</span><span class="o">:</span> <span class="nx">vec4</span><span class="p">,</span> <span class="nx">n</span><span class="o">:</span> <span class="mi">3</span> <span class="p">},</span>
    <span class="nx">color</span><span class="o">:</span> <span class="p">{</span> <span class="nx">type</span><span class="o">:</span> <span class="nx">vec4</span><span class="p">,</span> <span class="nx">n</span><span class="o">:</span> <span class="mi">3</span> <span class="p">}</span>
  <span class="p">}</span>
<span class="p">}</span>
</code></pre></div><p>Beam 中的着色器 Schema，需要提供 <code>fs / vs / buffers</code> 等字段。这里的一些要点包括如下：</p><ul><li>可以粗略认为，顶点着色器对三角形每个顶点执行一次，而片元着色器则对三角形内的每个像素执行一次。</li><li>顶点着色器和片元着色器，都是用 WebGL 标准中的 GLSL 语言编写的。这门语言其实就是 C 语言的变体，<code>vec4</code> 则是其内置的 4 维向量数据类型。</li><li>在 WebGL 中，顶点着色器将 <code>gl_Position</code> 变量作为坐标位置输出，而片元着色器则将 <code>gl_FragColor</code> 变量作为像素颜色输出。本例中的顶点和片元着色器，执行的都只是最简单的赋值操作。</li><li>名为 <code>vColor</code> 的 varying 变量，会由顶点着色器传递到片元着色器，并自动插值。最终三角形在顶点位置呈现我们定义的红绿蓝纯色，而其他位置则被渐变填充，这就是插值计算的结果。</li><li>变量前的 <code>highp</code> 修饰符用于指定精度，也可以在着色器最前面加一行 <code>precision highp float;</code> 来省略为每个变量手动指定精度。在现在这个时代，基本可以一律用高精度了。</li><li>这里 <code>position</code> 和 <code>color</code> 这两个 attribute 变量，和前面 <code>vertexBuffers</code> 中的 key 相对应。这也是 Beam 中的隐式约定。</li></ul><p>虽然到此为止的信息量可能比较大，但现在只要区区几十行代码，我们就可以清晰地用 Beam 来手动控制 WebGL 渲染了。接下来让我们看看，该如何把渲染出的<b>三角形</b>换成<b>矩形</b>。有了上面的铺垫，这个改动就显得非常简单了，稍微改几行代码就行。</p><p>我们的目标如下图所示：</p><figure data-size="normal"><img src="https://pic4.zhimg.com/v2-1373f0c7cece06fce0e393babd80f967_b.jpg" data-caption="" data-size="normal" data-rawwidth="200" data-rawheight="200" class="content_image" width="200"></figure><p>这对应于这样的代码：</p><div class="highlight"><pre><code class="language-js"><span></span><span class="kr">const</span> <span class="nx">vertexBuffers</span> <span class="o">=</span> <span class="nx">beam</span><span class="p">.</span><span class="nx">resource</span><span class="p">(</span><span class="nx">VertexBuffers</span><span class="p">,</span> <span class="p">{</span>
  <span class="nx">position</span><span class="o">:</span> <span class="p">[</span>
    <span class="o">-</span><span class="mi">1</span><span class="p">,</span> <span class="o">-</span><span class="mi">1</span><span class="p">,</span> <span class="mi">0</span><span class="p">,</span> <span class="c1">// vertex 0 左下角</span>
    <span class="o">-</span><span class="mi">1</span><span class="p">,</span> <span class="mi">1</span><span class="p">,</span> <span class="mi">0</span><span class="p">,</span> <span class="c1">// vertex 1 左上角</span>
    <span class="mi">1</span><span class="p">,</span> <span class="o">-</span><span class="mi">1</span><span class="p">,</span> <span class="mi">0</span><span class="p">,</span> <span class="c1">// vertex 2 右下角</span>
    <span class="mi">1</span><span class="p">,</span> <span class="mi">1</span><span class="p">,</span> <span class="mi">0</span> <span class="c1">// vertex 3 右上角</span>
  <span class="p">],</span>
  <span class="nx">color</span><span class="o">:</span> <span class="p">[</span>
    <span class="mi">1</span><span class="p">,</span> <span class="mi">0</span><span class="p">,</span> <span class="mi">0</span><span class="p">,</span> <span class="c1">// vertex 0 红色</span>
    <span class="mi">0</span><span class="p">,</span> <span class="mi">1</span><span class="p">,</span> <span class="mi">0</span><span class="p">,</span> <span class="c1">// vertex 1 绿色</span>
    <span class="mi">0</span><span class="p">,</span> <span class="mi">0</span><span class="p">,</span> <span class="mi">1</span><span class="p">,</span> <span class="c1">// vertex 2 蓝色</span>
    <span class="mi">1</span><span class="p">,</span> <span class="mi">1</span><span class="p">,</span> <span class="mi">0</span> <span class="c1">// vertex 3 黄色</span>
  <span class="p">]</span>
<span class="p">})</span>

<span class="kr">const</span> <span class="nx">indexBuffer</span> <span class="o">=</span> <span class="nx">beam</span><span class="p">.</span><span class="nx">resource</span><span class="p">(</span><span class="nx">IndexBuffer</span><span class="p">,</span> <span class="p">{</span>
  <span class="nx">array</span><span class="o">:</span> <span class="p">[</span>
    <span class="mi">0</span><span class="p">,</span> <span class="mi">1</span><span class="p">,</span> <span class="mi">2</span><span class="p">,</span> <span class="c1">// 左下三角形</span>
    <span class="mi">1</span><span class="p">,</span> <span class="mi">2</span><span class="p">,</span> <span class="mi">3</span> <span class="c1">// 右上三角形</span>
  <span class="p">]</span>
<span class="p">})</span>
</code></pre></div><p>其他代码完全不用改动，我们就能看到 Canvas 被填满了。这正好告诉了我们另一个重要信息：WebGL 的<b>屏幕坐标系</b>以画布中央为原点，画布左下角为 <i>(-1, -1)</i>，右上角则为 <i>(1, 1)</i>。如下图所示：</p><figure data-size="normal"><img src="https://pic3.zhimg.com/v2-41bc91d3311e3e17c89e3fe1001b2506_b.jpg" data-caption="" data-size="normal" data-rawwidth="1200" data-rawheight="400" class="origin_image zh-lightbox-thumb" width="1200" data-original="https://pic3.zhimg.com/v2-41bc91d3311e3e17c89e3fe1001b2506_r.jpg"></figure><p>注意，<b>不论画布长宽比例如何，这个坐标系的范围都是 -1 到 1 的</b>。只要尝试更改一下 Canvas 的尺寸，你就能知道这是什么意思了。</p><p>到目前为止，我们的渲染算法，其实只有片元着色器里的这一行：</p><div class="highlight"><pre><code class="language-glsl"><span></span><span class="kt">void</span> <span class="n">main</span><span class="p">()</span> <span class="p">{</span>
  <span class="nb">gl_FragColor</span> <span class="o">=</span> <span class="n">vColor</span><span class="p">;</span>
<span class="p">}</span>
</code></pre></div><p>对每个像素，这个 main 函数都会执行，将插值后的 varying 变量 <code>vColor</code> 颜色直接赋给 <code>gl_FragColor</code> 作为输出。能不能玩出些花样呢？很简单：</p><div class="highlight"><pre><code class="language-glsl"><span></span><span class="nb">gl_FragColor</span> <span class="o">=</span> <span class="kt">vec4</span><span class="p">(</span><span class="mf">0.8</span><span class="p">,</span> <span class="mf">0.9</span><span class="p">,</span> <span class="mf">0.6</span><span class="p">,</span> <span class="mf">0.4</span><span class="p">);</span> <span class="c1">// 固定颜色</span>
<span class="nb">gl_FragColor</span> <span class="o">=</span> <span class="n">vColor</span><span class="p">.</span><span class="n">xyzw</span><span class="p">;</span> <span class="c1">// 四个分量的语法糖</span>
<span class="nb">gl_FragColor</span> <span class="o">=</span> <span class="n">vColor</span><span class="p">.</span><span class="n">rgba</span><span class="p">;</span> <span class="c1">// 四个分量的等效语法糖</span>
<span class="nb">gl_FragColor</span> <span class="o">=</span> <span class="n">vColor</span><span class="p">.</span><span class="n">stpq</span><span class="p">;</span> <span class="c1">// 四个分量的等效语法糖</span>
<span class="nb">gl_FragColor</span> <span class="o">=</span> <span class="n">vColor</span> <span class="o">+</span> <span class="kt">vec4</span><span class="p">(</span><span class="mf">0.5</span><span class="p">);</span> <span class="c1">// 变淡</span>
<span class="nb">gl_FragColor</span> <span class="o">=</span> <span class="n">vColor</span> <span class="o">*</span> <span class="mf">0.5</span><span class="p">;</span> <span class="c1">// 变暗</span>
<span class="nb">gl_FragColor</span> <span class="o">=</span> <span class="n">vColor</span><span class="p">.</span><span class="n">yxzw</span><span class="p">;</span> <span class="c1">// 交换 X 与 Y 分量</span>
<span class="nb">gl_FragColor</span> <span class="o">=</span> <span class="n">vColor</span><span class="p">.</span><span class="n">rbga</span><span class="p">;</span> <span class="c1">// 交换 G 与 B 分量</span>
<span class="nb">gl_FragColor</span> <span class="o">=</span> <span class="n">vColor</span><span class="p">.</span><span class="n">rrrr</span><span class="p">;</span> <span class="c1">// 灰度展示 R 分量</span>
<span class="nb">gl_FragColor</span> <span class="o">=</span> <span class="kt">vec4</span><span class="p">(</span><span class="kt">vec2</span><span class="p">(</span><span class="mo">0</span><span class="p">),</span> <span class="n">vColor</span><span class="p">.</span><span class="n">ba</span><span class="p">);</span> <span class="c1">// 清空 R 与 G 分量</span>
</code></pre></div><p>这一步的例子，可以在 <a href="http://link.zhihu.com/?target=https%3A//doodlewind.github.io/beam/examples.html%23basic-graphics/hello-world" class=" wrap external" target="_blank" rel="nofollow noreferrer">Hello World</a> 这里访问到。</p><p>虽然这些例子只示范了 GLSL 的基本语法，但别忘了这可是编译到 GPU 上并行计算的代码，和单线程的 JS 有着云泥之别。只不过，目前我们的输入都是由各顶点之间的颜色插值而来，因此效果难以超出普通渐变的范畴。该怎样渲染出常见的点阵图像呢？到此我们终于可以进入正题，介绍与图像处理关系最为重大的<b>纹理资源</b>了。</p><h2>如何用 WebGL 渲染图像</h2><p>为了进行图像处理，浏览器中的 Image 对象显然是必须的输入。在 WebGL 中，Image 对象可以作为纹理，贴到多边形表面。这意味着，在片元着色器里，我们可以根据某种规则来<b>采样图像的某个位置</b>，将该位置的图像颜色作为输入，计算出最终屏幕上的像素颜色。显然，这个过程需要<b>在着色器里表达图像的不同位置</b>，这用到的就是所谓的纹理坐标系了。</p><p>纹理坐标系又叫 ST 坐标系。它以图像左下角为原点，右上角为 <i>(1, 1)</i> 坐标，同样与图像的宽高比例无关。这一坐标系的具体形式如下所示，配图来自笔者在卢浮宫拍摄的维纳斯像（嘿嘿）</p><figure data-size="normal"><img src="https://pic3.zhimg.com/v2-60cbbca299824d0f6eb678efc262f126_b.jpg" data-caption="" data-size="normal" data-rawwidth="1200" data-rawheight="400" class="origin_image zh-lightbox-thumb" width="1200" data-original="https://pic3.zhimg.com/v2-60cbbca299824d0f6eb678efc262f126_r.jpg"></figure><p>还记得我们先前给每个顶点附带了什么 attribute 属性吗？<b>坐标</b>和<b>颜色</b>。现在，我们需要将<b>颜色</b>换成<b>纹理坐标</b>，从而告诉 WebGL，正方形的每一个顶点应该对齐图像的哪一个位置，就像把被单的四个角对齐被套一样。这也就意味着我们需要依序提供上图中，纹理图像四个角落的坐标。若将这四个坐标当作颜色绘制出来，就能得到下图：</p><figure data-size="normal"><img src="https://pic1.zhimg.com/v2-d8913bb97ede73c7b12ae414705ddaf0_b.jpg" data-caption="" data-size="normal" data-rawwidth="1280" data-rawheight="427" class="origin_image zh-lightbox-thumb" width="1280" data-original="https://pic1.zhimg.com/v2-d8913bb97ede73c7b12ae414705ddaf0_r.jpg"></figure><p>不难看出，图中左下角对应 RGB 下的 <i>(0, 0, 0)</i> 黑色；左上角对应 RGB 下的 <i>(0, 1, 0)</i> 绿色；右下角对应 RGB 下的 <i>(1, 0, 0)</i> 红色；右上角则对应 RGB 下的 <i>(1, 1, 0)</i> 黄色。由此可见，这几个颜色 R 通道和 G 通道分量的取值，就和纹理坐标系中对应的 X Y 位置一致。这样一来，我们就用 RGB 颜色验证了数据的正确性。这种技巧也常对着色算法调试有所帮助。</p><p>和屏幕坐标系超出 <i>(-1, 1)</i> 区间就会被裁掉不同，纹理坐标系的取值可以是任意的正负浮点数。那么超过区间该怎么办呢？默认行为是平铺，像这样：</p><figure data-size="normal"><img src="https://pic3.zhimg.com/v2-9d51d98fc69df12e73cf986f24c3349a_b.jpg" data-caption="" data-size="normal" data-rawwidth="1200" data-rawheight="400" class="origin_image zh-lightbox-thumb" width="1200" data-original="https://pic3.zhimg.com/v2-9d51d98fc69df12e73cf986f24c3349a_r.jpg"></figure><p>但平铺不是唯一的行为。我们也可以修改 WebGL 状态，让纹理呈现出不同的展示效果（即所谓的 Wrap 缠绕模式），如下所示：</p><figure data-size="normal"><img src="https://pic2.zhimg.com/v2-b58456228a369f2abf87240803a31279_b.jpg" data-caption="" data-size="normal" data-rawwidth="1200" data-rawheight="400" class="origin_image zh-lightbox-thumb" width="1200" data-original="https://pic2.zhimg.com/v2-b58456228a369f2abf87240803a31279_r.jpg"></figure><p>除此之外，纹理还有采样方式等其他配置可供修改。我们暂且不考虑这么多，看看应该怎么将最基本的图像作为纹理渲染出来吧：</p><div class="highlight"><pre><code class="language-js"><span></span><span class="c1">// 创建着色器</span>
<span class="kr">const</span> <span class="nx">shader</span> <span class="o">=</span> <span class="nx">beam</span><span class="p">.</span><span class="nx">shader</span><span class="p">(</span><span class="nx">TextureDemo</span><span class="p">)</span>

<span class="c1">// 创建用于贴图的矩形</span>
<span class="kr">const</span> <span class="nx">rect</span> <span class="o">=</span> <span class="p">{</span>
  <span class="nx">vertex</span><span class="o">:</span> <span class="p">{</span>
    <span class="nx">position</span><span class="o">:</span> <span class="p">[</span>
      <span class="o">-</span><span class="mf">1.0</span><span class="p">,</span> <span class="o">-</span><span class="mf">1.0</span><span class="p">,</span> <span class="mf">0.0</span><span class="p">,</span>
      <span class="mf">1.0</span><span class="p">,</span> <span class="o">-</span><span class="mf">1.0</span><span class="p">,</span> <span class="mf">0.0</span><span class="p">,</span>
      <span class="mf">1.0</span><span class="p">,</span> <span class="mf">1.0</span><span class="p">,</span> <span class="mf">0.0</span><span class="p">,</span>
      <span class="o">-</span><span class="mf">1.0</span><span class="p">,</span> <span class="mf">1.0</span><span class="p">,</span> <span class="mf">0.0</span>
    <span class="p">],</span>
    <span class="nx">texCoord</span><span class="o">:</span> <span class="p">[</span>
      <span class="mf">0.0</span><span class="p">,</span> <span class="mf">0.0</span><span class="p">,</span>
      <span class="mf">1.0</span><span class="p">,</span> <span class="mf">0.0</span><span class="p">,</span>
      <span class="mf">1.0</span><span class="p">,</span> <span class="mf">1.0</span><span class="p">,</span>
      <span class="mf">0.0</span><span class="p">,</span> <span class="mf">1.0</span>
    <span class="p">]</span>
  <span class="p">},</span>
  <span class="nx">index</span><span class="o">:</span> <span class="p">{</span> <span class="nx">array</span><span class="o">:</span> <span class="p">[</span><span class="mi">0</span><span class="p">,</span> <span class="mi">1</span><span class="p">,</span> <span class="mi">2</span><span class="p">,</span> <span class="mi">0</span><span class="p">,</span> <span class="mi">2</span><span class="p">,</span> <span class="mi">3</span><span class="p">]</span> <span class="p">}</span>
<span class="p">}</span>
<span class="kr">const</span> <span class="nx">vertexBuffers</span> <span class="o">=</span> <span class="nx">beam</span><span class="p">.</span><span class="nx">resource</span><span class="p">(</span><span class="nx">VertexBuffers</span><span class="p">,</span> <span class="nx">rect</span><span class="p">.</span><span class="nx">vertex</span><span class="p">)</span>
<span class="kr">const</span> <span class="nx">indexBuffer</span> <span class="o">=</span> <span class="nx">beam</span><span class="p">.</span><span class="nx">resource</span><span class="p">(</span><span class="nx">IndexBuffer</span><span class="p">,</span> <span class="nx">rect</span><span class="p">.</span><span class="nx">index</span><span class="p">)</span>

<span class="c1">// 创建纹理资源</span>
<span class="kr">const</span> <span class="nx">textures</span> <span class="o">=</span> <span class="nx">beam</span><span class="p">.</span><span class="nx">resource</span><span class="p">(</span><span class="nx">Textures</span><span class="p">)</span>

<span class="c1">// 异步加载图像</span>
<span class="nx">fetchImage</span><span class="p">(</span><span class="s1">'venus.jpg'</span><span class="p">).</span><span class="nx">then</span><span class="p">(</span><span class="nx">image</span> <span class="p">=&gt;</span> <span class="p">{</span>
  <span class="c1">// 设入纹理图像后，执行绘制</span>
  <span class="nx">textures</span><span class="p">.</span><span class="nx">set</span><span class="p">(</span><span class="s1">'img'</span><span class="p">,</span> <span class="p">{</span> <span class="nx">image</span><span class="p">,</span> <span class="nx">flip</span><span class="o">:</span> <span class="kc">true</span> <span class="p">})</span>
  <span class="nx">beam</span>
    <span class="p">.</span><span class="nx">clear</span><span class="p">()</span>
    <span class="p">.</span><span class="nx">draw</span><span class="p">(</span><span class="nx">shader</span><span class="p">,</span> <span class="nx">vertexBuffers</span><span class="p">,</span> <span class="nx">indexBuffer</span><span class="p">,</span> <span class="nx">textures</span><span class="p">)</span>
<span class="p">})</span>
</code></pre></div><p>类似地，我们还是先看整体的渲染逻辑，再看着色器。整个过程其实很简单，可以概括为三步：</p><ol><li>初始化着色器、矩形资源和纹理资源</li><li>异步加载图像，完成后把图像设置为纹理</li><li>执行绘制</li></ol><p>相信大家在熟悉 Beam 的 API 后，应该不会觉得这部分代码有什么特别之处了吧。下面我们来关注重要的 <code>TextureDemo</code> 着色器部分，如下所示：</p><div class="highlight"><pre><code class="language-js"><span></span><span class="kr">const</span> <span class="nx">vs</span> <span class="o">=</span> <span class="sb">`</span>
<span class="sb">attribute vec4 position;</span>
<span class="sb">attribute vec2 texCoord;</span>
<span class="sb">varying highp vec2 vTexCoord;</span>

<span class="sb">void main() {</span>
<span class="sb">  vTexCoord = texCoord;</span>
<span class="sb">  gl_Position = position;</span>
<span class="sb">}</span>
<span class="sb">`</span>

<span class="kr">const</span> <span class="nx">fs</span> <span class="o">=</span> <span class="sb">`</span>
<span class="sb">varying highp vec2 vTexCoord;</span>
<span class="sb">uniform sampler2D img;</span>

<span class="sb">void main() {</span>
<span class="sb">  gl_FragColor = texture2D(img, vTexCoord);</span>
<span class="sb">}</span>
<span class="sb">`</span>

<span class="kr">const</span> <span class="p">{</span> <span class="nx">vec2</span><span class="p">,</span> <span class="nx">vec4</span><span class="p">,</span> <span class="nx">tex2D</span> <span class="p">}</span> <span class="o">=</span> <span class="nx">SchemaTypes</span>
<span class="kr">export</span> <span class="kr">const</span> <span class="nx">TextureDemo</span> <span class="o">=</span> <span class="p">{</span>
  <span class="nx">vs</span><span class="p">,</span>
  <span class="nx">fs</span><span class="p">,</span>
  <span class="nx">buffers</span><span class="o">:</span> <span class="p">{</span>
    <span class="nx">position</span><span class="o">:</span> <span class="p">{</span> <span class="nx">type</span><span class="o">:</span> <span class="nx">vec4</span><span class="p">,</span> <span class="nx">n</span><span class="o">:</span> <span class="mi">3</span> <span class="p">},</span>
    <span class="nx">texCoord</span><span class="o">:</span> <span class="p">{</span> <span class="nx">type</span><span class="o">:</span> <span class="nx">vec2</span> <span class="p">}</span>
  <span class="p">},</span>
  <span class="nx">textures</span><span class="o">:</span> <span class="p">{</span>
    <span class="nx">img</span><span class="o">:</span> <span class="p">{</span> <span class="nx">type</span><span class="o">:</span> <span class="nx">tex2D</span> <span class="p">}</span>
  <span class="p">}</span>
<span class="p">}</span>
</code></pre></div><p>就像 <code>vColor</code> 那样地，我们将 <code>vTexCoord</code> 变量从顶点着色器传入了片元着色器，这时同样隐含了插值处理。</p><p>这组着色器中，真正值得一提的是这么两行：</p><div class="highlight"><pre><code class="language-glsl"><span></span><span class="k">uniform</span> <span class="kt">sampler2D</span> <span class="n">img</span><span class="p">;</span>
<span class="c1">// ...</span>
<span class="nb">gl_FragColor</span> <span class="o">=</span> <span class="n">texture2D</span><span class="p">(</span><span class="n">img</span><span class="p">,</span> <span class="n">vTexCoord</span><span class="p">);</span>
</code></pre></div><p>你可以认为，片元着色器中 <code>uniform sampler2D</code> 类型的 <code>img</code> 变量，会被绑定到一张图像纹理上。然后，我们就可以用 WebGL 内置的 <code>texture2D</code> 函数来做纹理采样了。因此，这个着色器的渲染算法，其实就是采样 <code>img</code> 图像的 <code>vTexCoord</code> 位置，将获得的颜色作为该像素的输出。<b>对整个矩形内的每个像素点都执行一遍这个采样过程后，自然就把图像搬上屏幕了</b>。</p><p>让我们先歇一口气，欣赏下渲染出来的高雅艺术吧：</p><figure data-size="small"><img src="https://pic4.zhimg.com/v2-540fc3b0ac47cba8af597fd08a45c447_b.jpg" data-caption="" data-size="small" data-rawwidth="1024" data-rawheight="1024" class="origin_image zh-lightbox-thumb" width="1024" data-original="https://pic4.zhimg.com/v2-540fc3b0ac47cba8af597fd08a45c447_r.jpg"></figure><p>这一步的例子，可以在 <a href="http://link.zhihu.com/?target=https%3A//doodlewind.github.io/beam/examples.html%23image-processing/texture-config" class=" wrap external" target="_blank" rel="nofollow noreferrer">Texture Config</a> 这里访问到。</p><h2>如何为图像增加滤镜</h2><p>现在，图像的采样过程已经处于我们的着色器代码控制之下了。这意味着我们可以轻易地控制每个像素的渲染算法，实现图像滤镜。这具体要怎么做呢？下面拿这张笔者在布拉格拍的伏尔塔瓦河做例子（嘿嘿嘿）</p><figure data-size="normal"><img src="https://pic3.zhimg.com/v2-e76bc76b60fe448750edc28e2b931fd2_b.jpg" data-caption="" data-size="normal" data-rawwidth="2000" data-rawheight="1333" class="origin_image zh-lightbox-thumb" width="2000" data-original="https://pic3.zhimg.com/v2-e76bc76b60fe448750edc28e2b931fd2_r.jpg"></figure><p>我们看到了一张默认彩色的图像。最常见的滤镜操作之一，就是将它转为灰度图。这有很多种实现方式，而其中最简单的一种，不外乎把 RGB 通道的值全设置成一样的：</p><div class="highlight"><pre><code class="language-glsl"><span></span><span class="c1">// 先采样出纹理的 vec4 颜色</span>
<span class="kt">vec4</span> <span class="n">texColor</span> <span class="o">=</span> <span class="n">texture2D</span><span class="p">(</span><span class="n">img</span><span class="p">,</span> <span class="n">vTexCoord</span><span class="p">);</span>

<span class="c1">// 然后可以这样</span>
<span class="nb">gl_FragColor</span> <span class="o">=</span> <span class="n">texColor</span><span class="p">.</span><span class="n">rrra</span><span class="p">;</span>

<span class="c1">// 或者这样</span>
<span class="kt">float</span> <span class="n">average</span> <span class="o">=</span> <span class="p">(</span><span class="n">texColor</span><span class="p">.</span><span class="n">r</span> <span class="o">+</span> <span class="n">texColor</span><span class="p">.</span><span class="n">g</span> <span class="o">+</span> <span class="n">texColor</span><span class="p">.</span><span class="n">b</span><span class="p">)</span> <span class="o">/</span> <span class="mf">3.0</span><span class="p">;</span>
<span class="nb">gl_FragColor</span> <span class="o">=</span> <span class="kt">vec4</span><span class="p">(</span><span class="kt">vec3</span><span class="p">(</span><span class="n">average</span><span class="p">),</span> <span class="n">texColor</span><span class="p">.</span><span class="n">a</span><span class="p">);</span>
</code></pre></div><p>注意，在严格意义上，灰度化既不是用 R 通道覆盖 RGB，也不是对 RGB 通道简单取平均，而需要一个比例系数。这里为入门做了简化，效果如图：</p><figure data-size="normal"><img src="https://pic3.zhimg.com/v2-e12979169589337772ed5205b685a1be_b.jpg" data-caption="" data-size="normal" data-rawwidth="600" data-rawheight="400" class="origin_image zh-lightbox-thumb" width="600" data-original="https://pic3.zhimg.com/v2-e12979169589337772ed5205b685a1be_r.jpg"></figure><p>目前为止我们的着色器里，真正有效的代码都只有一两行而已。让我们来尝试下面这个更复杂一些的饱和度滤镜吧：</p><div class="highlight"><pre><code class="language-glsl"><span></span><span class="k">precision</span> <span class="k">highp</span> <span class="kt">float</span><span class="p">;</span>
<span class="k">uniform</span> <span class="kt">sampler2D</span> <span class="n">img</span><span class="p">;</span>
<span class="k">varying</span> <span class="kt">vec2</span> <span class="n">vTexCoord</span><span class="p">;</span>

<span class="k">const</span> <span class="kt">float</span> <span class="n">saturation</span> <span class="o">=</span> <span class="mf">0.5</span><span class="p">;</span> <span class="c1">// 饱和度比例常量</span>

<span class="kt">void</span> <span class="n">main</span><span class="p">()</span> <span class="p">{</span>
  <span class="kt">vec4</span> <span class="n">color</span> <span class="o">=</span> <span class="n">texture2D</span><span class="p">(</span><span class="n">img</span><span class="p">,</span> <span class="n">vTexCoord</span><span class="p">);</span>
  <span class="kt">float</span> <span class="n">average</span> <span class="o">=</span> <span class="p">(</span><span class="n">color</span><span class="p">.</span><span class="n">r</span> <span class="o">+</span> <span class="n">color</span><span class="p">.</span><span class="n">g</span> <span class="o">+</span> <span class="n">color</span><span class="p">.</span><span class="n">b</span><span class="p">)</span> <span class="o">/</span> <span class="mf">3.0</span><span class="p">;</span>
  <span class="k">if</span> <span class="p">(</span><span class="n">saturation</span> <span class="o">&gt;</span> <span class="mf">0.0</span><span class="p">)</span> <span class="p">{</span>
    <span class="n">color</span><span class="p">.</span><span class="n">rgb</span> <span class="o">+=</span> <span class="p">(</span><span class="n">average</span> <span class="o">-</span> <span class="n">color</span><span class="p">.</span><span class="n">rgb</span><span class="p">)</span> <span class="o">*</span> <span class="p">(</span><span class="mf">1.0</span> <span class="o">-</span> <span class="mf">1.0</span> <span class="o">/</span> <span class="p">(</span><span class="mf">1.001</span> <span class="o">-</span> <span class="n">saturation</span><span class="p">));</span>
  <span class="p">}</span> <span class="k">else</span> <span class="p">{</span>
    <span class="n">color</span><span class="p">.</span><span class="n">rgb</span> <span class="o">+=</span> <span class="p">(</span><span class="n">average</span> <span class="o">-</span> <span class="n">color</span><span class="p">.</span><span class="n">rgb</span><span class="p">)</span> <span class="o">*</span> <span class="p">(</span><span class="o">-</span><span class="n">saturation</span><span class="p">);</span>
  <span class="p">}</span>
  <span class="nb">gl_FragColor</span> <span class="o">=</span> <span class="n">color</span><span class="p">;</span>
<span class="p">}</span>
</code></pre></div><p>这个算法本身不是我们关注的重点，你很容易在社区找到各种各样的着色器。这里主要只是想告诉大家，着色器里是可以写 if else 的……</p><p>增加饱和度后，效果如图所示：</p><figure data-size="normal"><img src="https://pic3.zhimg.com/v2-32358e2625ffad381aaa5815ef3111f2_b.jpg" data-caption="" data-size="normal" data-rawwidth="600" data-rawheight="400" class="origin_image zh-lightbox-thumb" width="600" data-original="https://pic3.zhimg.com/v2-32358e2625ffad381aaa5815ef3111f2_r.jpg"></figure><p>但这里还有一个不大不小的问题，那就是现在的饱和度比例还是这样的一个常量：</p><div class="highlight"><pre><code class="language-glsl"><span></span><span class="k">const</span> <span class="kt">float</span> <span class="n">saturation</span> <span class="o">=</span> <span class="mf">0.5</span><span class="p">;</span>
</code></pre></div><p>如果要实现「拖动滑块调节滤镜效果强度」这样常见的需求，难道要不停地更改着色器源码吗？显然不是这样的。为此，我们需要引入最后一种关键的资源类型：Uniform 资源。</p><p>在 WebGL 中，Uniform 概念类似于全局变量。一般的全局变量，是在当前代码中可见，而 Uniform 则对于这个着色器<b>并行中的每次执行</b>，都是全局可见并唯一的。这样，着色器在计算每个像素的颜色时，都能拿到同一份「强度」参数的信息了。像上面 <code>uniform sampler2D</code> 类型的纹理采样器，就是这样的一个 Uniform 变量。只不过 Beam 处理了琐碎的下层细节，你只管把 JS 中的 Image 对象按约定传进来，就能把图像绑定到这个着色器变量里来使用了。</p><p>每个 Uniform 都是一份短小的数据，如 <code>vec4</code> 向量或 <code>mat4</code> 矩阵等。要想使用它，可以从简单的着色器代码修改开始：</p><div class="highlight"><pre><code class="language-glsl"><span></span><span class="k">precision</span> <span class="k">highp</span> <span class="kt">float</span><span class="p">;</span>
<span class="k">varying</span> <span class="kt">vec2</span> <span class="n">vTexCoord</span><span class="p">;</span>

<span class="k">uniform</span> <span class="kt">sampler2D</span> <span class="n">img</span><span class="p">;</span>
<span class="k">uniform</span> <span class="kt">float</span> <span class="n">saturation</span><span class="p">;</span> <span class="c1">// 由 const 改为 uniform</span>
</code></pre></div><p>该怎么给这个变量赋值呢？在 Schema 里适配一下就行：</p><div class="highlight"><pre><code class="language-js"><span></span><span class="kr">const</span> <span class="p">{</span> <span class="nx">vec2</span><span class="p">,</span> <span class="nx">vec4</span><span class="p">,</span> <span class="kr">float</span><span class="p">,</span> <span class="nx">tex2D</span> <span class="p">}</span> <span class="o">=</span> <span class="nx">SchemaTypes</span>
<span class="kr">export</span> <span class="kr">const</span> <span class="nx">TextureDemo</span> <span class="o">=</span> <span class="p">{</span>
  <span class="nx">vs</span><span class="p">,</span>
  <span class="nx">fs</span><span class="p">,</span>
  <span class="nx">buffers</span><span class="o">:</span> <span class="p">{</span>
    <span class="nx">position</span><span class="o">:</span> <span class="p">{</span> <span class="nx">type</span><span class="o">:</span> <span class="nx">vec4</span><span class="p">,</span> <span class="nx">n</span><span class="o">:</span> <span class="mi">3</span> <span class="p">},</span>
    <span class="nx">texCoord</span><span class="o">:</span> <span class="p">{</span> <span class="nx">type</span><span class="o">:</span> <span class="nx">vec2</span> <span class="p">}</span>
  <span class="p">},</span>
  <span class="nx">textures</span><span class="o">:</span> <span class="p">{</span>
    <span class="nx">img</span><span class="o">:</span> <span class="p">{</span> <span class="nx">type</span><span class="o">:</span> <span class="nx">tex2D</span> <span class="p">}</span>
  <span class="p">},</span>
  <span class="c1">// 新增这个 uniforms 字段</span>
  <span class="nx">uniforms</span><span class="o">:</span> <span class="p">{</span>
    <span class="nx">saturation</span><span class="o">:</span> <span class="p">{</span> <span class="nx">type</span><span class="o">:</span> <span class="kr">float</span><span class="p">,</span> <span class="k">default</span><span class="o">:</span> <span class="mf">0.5</span> <span class="p">}</span>
  <span class="p">}</span>
<span class="p">}</span>
</code></pre></div><p>这里的 <code>default</code> 属于方便调试的语法糖，理论上这时代码的运行结果是完全一致的，只是 <code>saturation</code> 变量从 Shader 中的常量变成了从 JS 里传入。怎么进一步控制它呢？其实也很简单，只需要 <code>beam.draw</code> 的时候多传入个资源就行了：</p><div class="highlight"><pre><code class="language-js"><span></span><span class="c1">// ...</span>
<span class="c1">// 创建 Uniform 资源</span>
<span class="kr">const</span> <span class="nx">uniforms</span> <span class="o">=</span> <span class="nx">beam</span><span class="p">.</span><span class="nx">resource</span><span class="p">(</span><span class="nx">Uniforms</span><span class="p">,</span> <span class="p">{</span>
  <span class="nx">saturation</span><span class="o">:</span> <span class="mf">0.5</span>
<span class="p">})</span>

<span class="c1">// 异步加载图像</span>
<span class="nx">fetchImage</span><span class="p">(</span><span class="s1">'venus.jpg'</span><span class="p">).</span><span class="nx">then</span><span class="p">(</span><span class="nx">image</span> <span class="p">=&gt;</span> <span class="p">{</span>
  <span class="nx">textures</span><span class="p">.</span><span class="nx">set</span><span class="p">(</span><span class="s1">'img'</span><span class="p">,</span> <span class="p">{</span> <span class="nx">image</span><span class="p">,</span> <span class="nx">flip</span><span class="o">:</span> <span class="kc">true</span> <span class="p">})</span>

  <span class="c1">// Uniform 可以随时更新</span>
  <span class="c1">// uniforms.set('saturation', 0.4)</span>
  <span class="nx">beam</span>
    <span class="p">.</span><span class="nx">clear</span><span class="p">()</span>
    <span class="p">.</span><span class="nx">draw</span><span class="p">(</span><span class="nx">shader</span><span class="p">,</span> <span class="nx">vertexBuffers</span><span class="p">,</span> <span class="nx">indexBuffer</span><span class="p">,</span> <span class="nx">uniforms</span><span class="p">,</span> <span class="nx">textures</span><span class="p">)</span>
<span class="p">})</span>
</code></pre></div><p>这样，我们就可以在 JS 中轻松地控制滤镜的强度了。像典型 3D 场景中，也是这样通过 Uniform 来控制相机位置等参数的。</p><p>我们还可以将 Uniform 数组与卷积核函数配合，实现图像的边缘检测、模糊等效果，并支持无缝的效果强度调整。不要怕所谓的卷积和核函数，它们的意思只是「计算一个像素时，可以采样它附近的像素」而已。由于这种手法并不需要太多额外的 WebGL 能力，这里就不再展开了。</p><p>这一步的例子，可以在 <a href="http://link.zhihu.com/?target=https%3A//doodlewind.github.io/beam/examples.html%23image-processing/single-filter" class=" wrap external" target="_blank" rel="nofollow noreferrer">Single Filter</a> 这里访问到。</p><h2>如何叠加多个图像</h2><p>现在，我们已经知道如何为单个图像编写着色器了。但另一个常见的需求是，如何处理需要混叠的多张图像呢？下面让我们看看该如何处理这样的图像叠加效果：</p><figure data-size="normal"><img src="https://pic2.zhimg.com/v2-21858cf0463284fdecde8a25af13cdbd_b.jpg" data-caption="" data-size="normal" data-rawwidth="1000" data-rawheight="400" class="origin_image zh-lightbox-thumb" width="1000" data-original="https://pic2.zhimg.com/v2-21858cf0463284fdecde8a25af13cdbd_r.jpg"></figure><p>JS 侧的渲染逻辑如下所示：</p><div class="highlight"><pre><code class="language-js"><span></span><span class="c1">// ...</span>
<span class="kr">const</span> <span class="nx">render</span> <span class="o">=</span> <span class="p">([</span><span class="nx">imageA</span><span class="p">,</span> <span class="nx">imageB</span><span class="p">])</span> <span class="p">=&gt;</span> <span class="p">{</span>
  <span class="kr">const</span> <span class="nx">imageStates</span> <span class="o">=</span> <span class="p">{</span>
    <span class="nx">img0</span><span class="o">:</span> <span class="p">{</span> <span class="nx">image</span><span class="o">:</span> <span class="nx">imageA</span><span class="p">,</span> <span class="nx">flip</span><span class="o">:</span> <span class="kc">true</span> <span class="p">},</span>
    <span class="nx">img1</span><span class="o">:</span> <span class="p">{</span> <span class="nx">image</span><span class="o">:</span> <span class="nx">imageB</span><span class="p">,</span> <span class="nx">flip</span><span class="o">:</span> <span class="kc">true</span> <span class="p">}</span>
  <span class="p">}</span>

  <span class="nx">beam</span><span class="p">.</span><span class="nx">clear</span><span class="p">().</span><span class="nx">draw</span><span class="p">(</span>
    <span class="nx">shader</span><span class="p">,</span>
    <span class="nx">beam</span><span class="p">.</span><span class="nx">resource</span><span class="p">(</span><span class="nx">VertexBuffers</span><span class="p">,</span> <span class="nx">rect</span><span class="p">.</span><span class="nx">vertex</span><span class="p">),</span>
    <span class="nx">beam</span><span class="p">.</span><span class="nx">resource</span><span class="p">(</span><span class="nx">IndexBuffer</span><span class="p">,</span> <span class="nx">rect</span><span class="p">.</span><span class="nx">index</span><span class="p">),</span>
    <span class="nx">beam</span><span class="p">.</span><span class="nx">resource</span><span class="p">(</span><span class="nx">Textures</span><span class="p">,</span> <span class="nx">imageStates</span><span class="p">)</span>
  <span class="p">)</span>
<span class="p">}</span>

<span class="nx">loadImages</span><span class="p">(</span><span class="s1">'html5-logo.jpg'</span><span class="p">,</span> <span class="s1">'black-hole.jpg'</span><span class="p">).</span><span class="nx">then</span><span class="p">(</span><span class="nx">render</span><span class="p">)</span>
</code></pre></div><p>这里只需要渲染一次，故而没有单独为 <code>VertexBuffers</code> 和 <code>IndexBuffer</code> 等资源变量命名，直接在 <code>draw</code> 的时候初始化就行。那么关键的 Shader 该如何实现呢？此时的着色器 Schema 结构是这样的：</p><div class="highlight"><pre><code class="language-js"><span></span><span class="kr">const</span> <span class="nx">fs</span> <span class="o">=</span> <span class="sb">`</span>
<span class="sb">precision highp float;</span>
<span class="sb">uniform sampler2D img0;</span>
<span class="sb">uniform sampler2D img1;</span>
<span class="sb">varying vec2 vTexCoord;</span>

<span class="sb">void main() {</span>
<span class="sb">  vec4 color0 = texture2D(img0, vTexCoord);</span>
<span class="sb">  vec4 color1 = texture2D(img1, vTexCoord);</span>
<span class="sb">  gl_FragColor = color0 * color1.r;</span>
<span class="sb">}</span>
<span class="sb">`</span>

<span class="kr">const</span> <span class="p">{</span> <span class="nx">vec2</span><span class="p">,</span> <span class="nx">vec4</span><span class="p">,</span> <span class="nx">mat4</span><span class="p">,</span> <span class="nx">tex2D</span> <span class="p">}</span> <span class="o">=</span> <span class="nx">SchemaTypes</span>
<span class="kr">export</span> <span class="kr">const</span> <span class="nx">MixImage</span> <span class="o">=</span> <span class="p">{</span>
  <span class="nx">vs</span><span class="p">,</span> <span class="c1">// 顶点着色器和前例相同</span>
  <span class="nx">fs</span><span class="p">,</span>
  <span class="nx">buffers</span><span class="o">:</span> <span class="p">{</span>
    <span class="nx">position</span><span class="o">:</span> <span class="p">{</span> <span class="nx">type</span><span class="o">:</span> <span class="nx">vec4</span><span class="p">,</span> <span class="nx">n</span><span class="o">:</span> <span class="mi">3</span> <span class="p">},</span>
    <span class="nx">texCoord</span><span class="o">:</span> <span class="p">{</span> <span class="nx">type</span><span class="o">:</span> <span class="nx">vec2</span> <span class="p">}</span>
  <span class="p">},</span>
  <span class="nx">textures</span><span class="o">:</span> <span class="p">{</span>
    <span class="nx">img0</span><span class="o">:</span> <span class="p">{</span> <span class="nx">type</span><span class="o">:</span> <span class="nx">tex2D</span> <span class="p">},</span>
    <span class="nx">img1</span><span class="o">:</span> <span class="p">{</span> <span class="nx">type</span><span class="o">:</span> <span class="nx">tex2D</span> <span class="p">}</span>
  <span class="p">}</span>
<span class="p">}</span>
</code></pre></div><p>这里的核心代码在于 <code>gl_FragColor = color0 * color1.r;</code> 这一句，而这两个颜色则分别来自于对两张图像的 <code>texture2D</code> 采样。有了更丰富的输入，我们自然可以有更多的变化可以玩了。比如这样：</p><div class="highlight"><pre><code class="language-glsl"><span></span><span class="nb">gl_FragColor</span> <span class="o">=</span> <span class="n">color0</span> <span class="o">*</span> <span class="p">(</span><span class="mf">1.0</span> <span class="o">-</span> <span class="n">color1</span><span class="p">.</span><span class="n">r</span><span class="p">);</span>
</code></pre></div><p>就可以得到相反的叠加结果。</p><p>在现在的 WebGL 里，我们一般可以至少同时使用 16 个纹理。这个上限说实话也不小了，对于常见的图像混叠需求也都能很好地满足。但是浏览器自身也是通过类似的 GPU 渲染管线来渲染的，它是怎么渲染页面里动辄成百上千张图像的呢？这说起来知易行难，靠的是分块多次绘制。</p><p>这一步的例子，可以在 <a href="http://link.zhihu.com/?target=https%3A//doodlewind.github.io/beam/examples.html%23image-processing/mix-images" class=" wrap external" target="_blank" rel="nofollow noreferrer">Mix Images</a> 这里访问到。</p><h2>如何组合多个滤镜</h2><p>到现在为止我们已经单独实现过多种滤镜了，但如何将它们的效果串联起来呢？WebGL 的着色器毕竟是字符串，我们可以做魔改拼接，生成不同的着色器。这确实是许多 3D 库中的普遍实践，也利于追求极致的性能。但这里选择的是一种工程上实现更为简洁优雅的方式，即离屏的链式渲染。</p><p>假设我们有 A B C 等多种滤镜（即用于图像处理的着色器），那么该如何将它们的效果依次应用到图像上呢？我们需要先为原图应用滤镜 A，然后将 A 的渲染结果传给 B，再将 A + B 的渲染结果传给 C…依此类推，即可组成一条完整的滤镜链。</p><p>为了实现这一目标，我们显然需要暂存某次渲染的结果。熟悉 Canvas 的同学一定对离屏渲染不陌生，在 WebGL 中也有类似的概念。但 WebGL 的离屏渲染，并不像 Canvas 那样能直接新建多个离屏的 <code>&lt;canvas&gt;</code> 标签，而是以<b>渲染到纹理</b>的方式来实现的。</p><p>在给出代码前，我们需要先做些必要的科普。在 WebGL 和 OpenGL 体系中有个最为经典的命名槽点，那就是 Buffer 和 Framebuffer 其实完全是两种东西（不要误给 Framebuffer 加了驼峰命名噢）。<b>Buffer 可以理解为存储大段有序数据的对象，而 Framebuffer 指代的则是屏幕</b>！一般来说，我们渲染到屏幕时，使用的就是默认的物理 Framebuffer。但离屏渲染时，我们渲染的 Framebuffer 是个虚拟的对象，即所谓的 Framebuffer Object (FBO)。纹理对象可以 attach 到 Framebuffer Object 上，这样绘制时就会将像素数据写到内存，而不是物理显示设备了。</p><p>上面的介绍有些绕口，其实只要记住这两件事就对了：</p><ul><li>离屏渲染时，要将渲染目标从物理 Framebuffer 换成 FBO。</li><li>FBO 只是个壳，要将纹理对象挂载上去，这才是像素真正写入的地方。</li></ul><p>对离屏渲染，Beam 也提供了完善的支持。FBO 有些绕口，因此 Beam 提供了名为 <code>OffscreenTarget</code> 的特殊资源对象。这种对象该如何使用呢？假设现在我们有 3 个着色器，分别是用于调整对比度、色相和晕影的滤镜，那么将它们串联使用的代码示例如下：</p><div class="highlight"><pre><code class="language-js"><span></span><span class="kr">import</span> <span class="p">{</span> <span class="nx">Beam</span><span class="p">,</span> <span class="nx">ResourceTypes</span><span class="p">,</span> <span class="nx">Offscreen2DCommand</span> <span class="p">}</span> <span class="nx">from</span> <span class="s1">'beam-gl'</span>

<span class="c1">// ...</span>
<span class="kr">const</span> <span class="nx">beam</span> <span class="o">=</span> <span class="k">new</span> <span class="nx">Beam</span><span class="p">(</span><span class="nx">canvas</span><span class="p">)</span>
<span class="c1">// 默认导入的最小包不带离屏支持，需手动扩展</span>
<span class="nx">beam</span><span class="p">.</span><span class="nx">define</span><span class="p">(</span><span class="nx">Offscreen2DCommand</span><span class="p">)</span>

<span class="c1">// ...</span>
<span class="c1">// 原图的纹理资源</span>
<span class="kr">const</span> <span class="nx">inputTextures</span> <span class="o">=</span> <span class="nx">beam</span><span class="p">.</span><span class="nx">resource</span><span class="p">(</span><span class="nx">Textures</span><span class="p">)</span>

<span class="c1">// 中间环节所用的纹理资源</span>
<span class="kr">const</span> <span class="nx">outputTextures</span> <span class="o">=</span> <span class="p">[</span>
  <span class="nx">beam</span><span class="p">.</span><span class="nx">resource</span><span class="p">(</span><span class="nx">Textures</span><span class="p">),</span>
  <span class="nx">beam</span><span class="p">.</span><span class="nx">resource</span><span class="p">(</span><span class="nx">Textures</span><span class="p">)</span>
<span class="p">]</span>

<span class="c1">// 中间环节所用的离屏对象</span>
<span class="kr">const</span> <span class="nx">targets</span> <span class="o">=</span> <span class="p">[</span>
  <span class="nx">beam</span><span class="p">.</span><span class="nx">resource</span><span class="p">(</span><span class="nx">OffscreenTarget</span><span class="p">),</span>
  <span class="nx">beam</span><span class="p">.</span><span class="nx">resource</span><span class="p">(</span><span class="nx">OffscreenTarget</span><span class="p">)</span>
<span class="p">]</span>

<span class="c1">// 将纹理挂载到离屏对象上，这步的语义暂时还不太直观</span>
<span class="nx">outputTextures</span><span class="p">[</span><span class="mi">0</span><span class="p">].</span><span class="nx">set</span><span class="p">(</span><span class="s1">'img'</span><span class="p">,</span> <span class="nx">targets</span><span class="p">[</span><span class="mi">0</span><span class="p">])</span>
<span class="nx">outputTextures</span><span class="p">[</span><span class="mi">1</span><span class="p">].</span><span class="nx">set</span><span class="p">(</span><span class="s1">'img'</span><span class="p">,</span> <span class="nx">targets</span><span class="p">[</span><span class="mi">1</span><span class="p">])</span>

<span class="c1">// 固定的矩形 Buffer 资源</span>
<span class="kr">const</span> <span class="nx">rect</span><span class="o">=</span> <span class="p">[</span><span class="nx">rectVertex</span><span class="p">,</span> <span class="nx">rectIndex</span><span class="p">]</span>

<span class="kr">const</span> <span class="nx">render</span> <span class="o">=</span> <span class="nx">image</span> <span class="p">=&gt;</span> <span class="p">{</span>
  <span class="c1">// 更新输入纹理</span>
  <span class="nx">inputTextures</span><span class="p">.</span><span class="nx">set</span><span class="p">(</span><span class="s1">'img'</span><span class="p">,</span> <span class="p">{</span> <span class="nx">image</span><span class="p">,</span> <span class="nx">flip</span><span class="o">:</span> <span class="kc">true</span> <span class="p">})</span>

  <span class="nx">beam</span><span class="p">.</span><span class="nx">clear</span><span class="p">()</span>
  <span class="nx">beam</span>
    <span class="c1">// 用输入纹理，渲染对比度滤镜到第一个离屏对象</span>
    <span class="p">.</span><span class="nx">offscreen2D</span><span class="p">(</span><span class="nx">targets</span><span class="p">[</span><span class="mi">0</span><span class="p">],</span> <span class="p">()</span> <span class="p">=&gt;</span> <span class="p">{</span>
      <span class="nx">beam</span><span class="p">.</span><span class="nx">draw</span><span class="p">(</span><span class="nx">contrastShader</span><span class="p">,</span> <span class="p">...</span><span class="nx">rect</span><span class="p">,</span> <span class="nx">inputTextures</span><span class="p">)</span>
    <span class="p">})</span>
    <span class="c1">// 用第一个输出纹理，渲染色相滤镜到第二个离屏对象</span>
    <span class="p">.</span><span class="nx">offscreen2D</span><span class="p">(</span><span class="nx">targets</span><span class="p">[</span><span class="mi">1</span><span class="p">],</span> <span class="p">()</span> <span class="p">=&gt;</span> <span class="p">{</span>
      <span class="nx">beam</span><span class="p">.</span><span class="nx">draw</span><span class="p">(</span><span class="nx">hueShader</span><span class="p">,</span> <span class="p">...</span><span class="nx">rect</span><span class="p">,</span> <span class="nx">outputTextures</span><span class="p">[</span><span class="mi">0</span><span class="p">])</span>
    <span class="p">})</span>

  <span class="c1">// 用第二个输出纹理，渲染晕影滤镜直接上屏</span>
  <span class="nx">beam</span><span class="p">.</span><span class="nx">draw</span><span class="p">(</span><span class="nx">vignetteShader</span><span class="p">,</span> <span class="p">...</span><span class="nx">rect</span><span class="p">,</span> <span class="nx">outputTextures</span><span class="p">[</span><span class="mi">1</span><span class="p">])</span>
<span class="p">}</span>

<span class="nx">fetchImage</span><span class="p">(</span><span class="s1">'prague.jpg'</span><span class="p">).</span><span class="nx">then</span><span class="p">(</span><span class="nx">render</span><span class="p">)</span>
</code></pre></div><p>这里的渲染逻辑，其实只是将原本这样的代码结构：</p><div class="highlight"><pre><code class="language-js"><span></span><span class="nx">beam</span>
  <span class="p">.</span><span class="nx">clear</span><span class="p">()</span>
  <span class="p">.</span><span class="nx">draw</span><span class="p">(</span><span class="nx">shaderX</span><span class="p">,</span> <span class="p">...</span><span class="nx">resourcesA</span><span class="p">)</span>
  <span class="p">.</span><span class="nx">draw</span><span class="p">(</span><span class="nx">shaderY</span><span class="p">,</span> <span class="p">...</span><span class="nx">resourcesB</span><span class="p">)</span>
  <span class="p">.</span><span class="nx">draw</span><span class="p">(</span><span class="nx">shaderZ</span><span class="p">,</span> <span class="p">...</span><span class="nx">resourcesC</span><span class="p">)</span>
</code></pre></div><p>换成了扩展 <code>offscreen2D</code> API 后的这样：</p><div class="highlight"><pre><code class="language-js"><span></span><span class="nx">beam</span>
  <span class="p">.</span><span class="nx">clear</span><span class="p">()</span>
  <span class="p">.</span><span class="nx">offscreen2D</span><span class="p">(</span><span class="nx">targetP</span><span class="p">,</span> <span class="p">()</span> <span class="p">=&gt;</span> <span class="p">{</span>
    <span class="nx">beam</span><span class="p">.</span><span class="nx">draw</span><span class="p">(</span><span class="nx">shaderX</span><span class="p">,</span> <span class="p">...</span><span class="nx">resourcesA</span><span class="p">)</span>
  <span class="p">})</span>
  <span class="p">.</span><span class="nx">offscreen2D</span><span class="p">(</span><span class="nx">targetQ</span><span class="p">,</span> <span class="p">()</span> <span class="p">=&gt;</span> <span class="p">{</span>
    <span class="nx">beam</span><span class="p">.</span><span class="nx">draw</span><span class="p">(</span><span class="nx">shaderY</span><span class="p">,</span> <span class="p">...</span><span class="nx">resourcesB</span><span class="p">)</span>
  <span class="p">})</span>
  <span class="p">.</span><span class="nx">offscreen2D</span><span class="p">(</span><span class="nx">targetR</span><span class="p">,</span> <span class="p">()</span> <span class="p">=&gt;</span> <span class="p">{</span>
    <span class="nx">beam</span><span class="p">.</span><span class="nx">draw</span><span class="p">(</span><span class="nx">shaderZ</span><span class="p">,</span> <span class="p">...</span><span class="nx">resourcesC</span><span class="p">)</span>
  <span class="p">})</span>
<span class="c1">// 还需要在外面再 beam.draw 一次，才能把结果上屏</span>
</code></pre></div><p>只要被嵌套在 <code>offscreen2D</code> 函数里，那么 <code>beam.draw</code> 在功能完全不变的前提下，渲染结果会全部走到相应的离屏对象里，从而写入离屏对象所挂载的纹理上。这样，<b>我们就用函数的作用域表达出了离屏渲染的作用域</b>！这是 Beam 的一大创新点，能用来支持非常灵活的渲染逻辑。比如这样的嵌套渲染结构，也是完全合法的：</p><div class="highlight"><pre><code class="language-js"><span></span><span class="nx">beam</span>
  <span class="p">.</span><span class="nx">clear</span><span class="p">()</span>
  <span class="p">.</span><span class="nx">offscreen2D</span><span class="p">(</span><span class="nx">target</span><span class="p">,</span> <span class="p">()</span> <span class="p">=&gt;</span> <span class="p">{</span>
    <span class="nx">beam</span>
      <span class="p">.</span><span class="nx">draw</span><span class="p">(</span><span class="nx">shaderX</span><span class="p">,</span> <span class="p">...</span><span class="nx">resourcesA</span><span class="p">)</span>
      <span class="p">.</span><span class="nx">draw</span><span class="p">(</span><span class="nx">shaderY</span><span class="p">,</span> <span class="p">...</span><span class="nx">resourcesB</span><span class="p">)</span>
      <span class="p">.</span><span class="nx">draw</span><span class="p">(</span><span class="nx">shaderZ</span><span class="p">,</span> <span class="p">...</span><span class="nx">resourcesC</span><span class="p">)</span>
  <span class="p">})</span>
  <span class="p">.</span><span class="nx">draw</span><span class="p">(</span><span class="nx">shaderW</span><span class="p">,</span> <span class="p">...</span><span class="nx">resourcesD</span><span class="p">)</span>
</code></pre></div><p>离屏渲染的 API 看似简单，其实是 Beam 中耗费最多时间设计的特性之一，目前的方案也是经历过若干次失败的尝试，推翻了用数组、树和有向无环图来结构化表达渲染逻辑的方向后才确定的。当然它目前也还有不够理想的地方，希望大家可以多反馈意见和建议。</p><p>现在，我们就能尝到滤镜链在可组合性上的甜头了。在依次应用了对比度、色相和晕影三个着色器后，渲染效果如下所示：</p><figure data-size="normal"><img src="https://pic2.zhimg.com/v2-fd36728d33d397a39762fbb689efa011_b.jpg" data-caption="" data-size="normal" data-rawwidth="600" data-rawheight="400" class="origin_image zh-lightbox-thumb" width="600" data-original="https://pic2.zhimg.com/v2-fd36728d33d397a39762fbb689efa011_r.jpg"></figure><p>这一步的例子，可以在 <a href="http://link.zhihu.com/?target=https%3A//doodlewind.github.io/beam/examples.html%23image-processing/multi-filters" class=" wrap external" target="_blank" rel="nofollow noreferrer">Multi Filters</a> 这里访问到。</p><h2>如何引入 3D 效果</h2><p>现在，我们已经基本覆盖了 2D 领域的 WebGL 图像处理技巧了。那么，是否有可能利用 WebGL 在 3D 领域的能力，实现一些更为强大的特效呢？当然可以。下面我们就给出一个基于 Beam 实现「高性能图片爆破轮播」的例子。</p><blockquote> 本节内容源自笔者在 <a href="https://www.zhihu.com/question/327977600/answer/728411768" class="internal">现在作为前端入门，还有必要去学习高难度的 CSS 和 JS 特效吗？</a>问题下的问答。阅读过这个回答的同学也可以跳过。</blockquote><p>相信大家应该见过一些图片爆炸散开成为粒子的效果，这实际上就是将图片拆解为了一堆形状。这时不妨假设图像位于单位坐标系上，将图像拆分为许多爆破粒子，每个粒子都是由两个三角形组成的小矩形。摄像机从 Z 轴俯视下去，就像这样：</p><figure data-size="normal"><img src="https://pic1.zhimg.com/v2-f593398823b654325e592fe004b76998_b.jpg" data-caption="" data-size="normal" data-rawwidth="1519" data-rawheight="940" class="origin_image zh-lightbox-thumb" width="1519" data-original="https://pic1.zhimg.com/v2-f593398823b654325e592fe004b76998_r.jpg"></figure><p>相应的数据结构呢？以上图的粒子为例，其中一个刚好在 X 轴中间的顶点，大致需要这些参数：</p><figure data-size="normal"><img src="https://pic3.zhimg.com/v2-d422958ca4932748193fc05508b8d2ce_b.jpg" data-caption="" data-size="normal" data-rawwidth="1539" data-rawheight="1185" class="origin_image zh-lightbox-thumb" width="1539" data-original="https://pic3.zhimg.com/v2-d422958ca4932748193fc05508b8d2ce_r.jpg"></figure><ul><li>空间位置，是粒子的三维坐标，这很好理解</li><li>纹理位置，告诉 GPU 需要采样图像的哪个部分</li><li>粒子中心位置，相当于让四个顶点团结在一起的 ID，免得各自跑偏了</li></ul><p>只要 50 行左右的 JS，我们就可以完成初始数据的计算：</p><div class="highlight"><pre><code class="language-js"><span></span><span class="c1">// 这种数据处理场景下，这个简陋的 push 性能好很多</span>
<span class="kr">const</span> <span class="nx">push</span> <span class="o">=</span> <span class="p">(</span><span class="nx">arr</span><span class="p">,</span> <span class="nx">x</span><span class="p">)</span> <span class="p">=&gt;</span> <span class="p">{</span> <span class="nx">arr</span><span class="p">[</span><span class="nx">arr</span><span class="p">.</span><span class="nx">length</span><span class="p">]</span> <span class="o">=</span> <span class="nx">x</span> <span class="p">}</span>

<span class="c1">// 生成将图像等分为 n x n 矩形的数据</span>
<span class="kr">const</span> <span class="nx">initParticlesData</span> <span class="o">=</span> <span class="nx">n</span> <span class="p">=&gt;</span> <span class="p">{</span>
  <span class="kr">const</span> <span class="p">[</span><span class="nx">positions</span><span class="p">,</span> <span class="nx">centers</span><span class="p">,</span> <span class="nx">texCoords</span><span class="p">,</span> <span class="nx">indices</span><span class="p">]</span> <span class="o">=</span> <span class="p">[[],</span> <span class="p">[],</span> <span class="p">[],</span> <span class="p">[]]</span>

  <span class="c1">// 这种时候求别用 forEach 了</span>
  <span class="k">for</span> <span class="p">(</span><span class="kd">let</span> <span class="nx">i</span> <span class="o">=</span> <span class="mi">0</span><span class="p">;</span> <span class="nx">i</span> <span class="o">&lt;</span> <span class="nx">n</span><span class="p">;</span> <span class="nx">i</span><span class="o">++</span><span class="p">)</span> <span class="p">{</span>
    <span class="k">for</span> <span class="p">(</span><span class="kd">let</span> <span class="nx">j</span> <span class="o">=</span> <span class="mi">0</span><span class="p">;</span> <span class="nx">j</span> <span class="o">&lt;</span> <span class="nx">n</span><span class="p">;</span> <span class="nx">j</span><span class="o">++</span><span class="p">)</span> <span class="p">{</span>
      <span class="kr">const</span> <span class="p">[</span><span class="nx">x0</span><span class="p">,</span> <span class="nx">x1</span><span class="p">]</span> <span class="o">=</span> <span class="p">[</span><span class="nx">i</span> <span class="o">/</span> <span class="nx">n</span><span class="p">,</span> <span class="p">(</span><span class="nx">i</span> <span class="o">+</span> <span class="mi">1</span><span class="p">)</span> <span class="o">/</span> <span class="nx">n</span><span class="p">]</span> <span class="c1">// 每个粒子的 x 轴左右坐标</span>
      <span class="kr">const</span> <span class="p">[</span><span class="nx">y0</span><span class="p">,</span> <span class="nx">y1</span><span class="p">]</span> <span class="o">=</span> <span class="p">[</span><span class="nx">j</span> <span class="o">/</span> <span class="nx">n</span><span class="p">,</span> <span class="p">(</span><span class="nx">j</span> <span class="o">+</span> <span class="mi">1</span><span class="p">)</span> <span class="o">/</span> <span class="nx">n</span><span class="p">]</span> <span class="c1">// 每个粒子的 y 轴上下坐标</span>
      <span class="kr">const</span> <span class="p">[</span><span class="nx">xC</span><span class="p">,</span> <span class="nx">yC</span><span class="p">]</span> <span class="o">=</span> <span class="p">[</span><span class="nx">x0</span> <span class="o">+</span> <span class="nx">x1</span> <span class="o">/</span> <span class="mi">2</span><span class="p">,</span> <span class="nx">y0</span> <span class="o">+</span> <span class="nx">y1</span> <span class="o">/</span> <span class="mi">2</span><span class="p">]</span> <span class="c1">// 每个粒子的中心二维坐标</span>
      <span class="kr">const</span> <span class="nx">h</span> <span class="o">=</span> <span class="mf">0.5</span> <span class="c1">// 将中心点从 (0.5, 0.5) 平移到原点的偏移量</span>

      <span class="c1">// positions in (x, y), z = 0</span>
      <span class="nx">push</span><span class="p">(</span><span class="nx">positions</span><span class="p">,</span> <span class="nx">x0</span> <span class="o">-</span> <span class="nx">h</span><span class="p">);</span> <span class="nx">push</span><span class="p">(</span><span class="nx">positions</span><span class="p">,</span> <span class="nx">y0</span> <span class="o">-</span> <span class="nx">h</span><span class="p">)</span>
      <span class="nx">push</span><span class="p">(</span><span class="nx">positions</span><span class="p">,</span> <span class="nx">x1</span> <span class="o">-</span> <span class="nx">h</span><span class="p">);</span> <span class="nx">push</span><span class="p">(</span><span class="nx">positions</span><span class="p">,</span> <span class="nx">y0</span> <span class="o">-</span> <span class="nx">h</span><span class="p">)</span>
      <span class="nx">push</span><span class="p">(</span><span class="nx">positions</span><span class="p">,</span> <span class="nx">x1</span> <span class="o">-</span> <span class="nx">h</span><span class="p">);</span> <span class="nx">push</span><span class="p">(</span><span class="nx">positions</span><span class="p">,</span> <span class="nx">y1</span> <span class="o">-</span> <span class="nx">h</span><span class="p">)</span>
      <span class="nx">push</span><span class="p">(</span><span class="nx">positions</span><span class="p">,</span> <span class="nx">x0</span> <span class="o">-</span> <span class="nx">h</span><span class="p">);</span> <span class="nx">push</span><span class="p">(</span><span class="nx">positions</span><span class="p">,</span> <span class="nx">y1</span> <span class="o">-</span> <span class="nx">h</span><span class="p">)</span>

      <span class="c1">// texCoords in (x, y)</span>
      <span class="nx">push</span><span class="p">(</span><span class="nx">texCoords</span><span class="p">,</span> <span class="nx">x0</span><span class="p">);</span> <span class="nx">push</span><span class="p">(</span><span class="nx">texCoords</span><span class="p">,</span> <span class="nx">y0</span><span class="p">)</span>
      <span class="nx">push</span><span class="p">(</span><span class="nx">texCoords</span><span class="p">,</span> <span class="nx">x1</span><span class="p">);</span> <span class="nx">push</span><span class="p">(</span><span class="nx">texCoords</span><span class="p">,</span> <span class="nx">y0</span><span class="p">)</span>
      <span class="nx">push</span><span class="p">(</span><span class="nx">texCoords</span><span class="p">,</span> <span class="nx">x1</span><span class="p">);</span> <span class="nx">push</span><span class="p">(</span><span class="nx">texCoords</span><span class="p">,</span> <span class="nx">y1</span><span class="p">)</span>
      <span class="nx">push</span><span class="p">(</span><span class="nx">texCoords</span><span class="p">,</span> <span class="nx">x0</span><span class="p">);</span> <span class="nx">push</span><span class="p">(</span><span class="nx">texCoords</span><span class="p">,</span> <span class="nx">y1</span><span class="p">)</span>

      <span class="c1">// center in (x, y), z = 0</span>
      <span class="nx">push</span><span class="p">(</span><span class="nx">centers</span><span class="p">,</span> <span class="nx">xC</span> <span class="o">-</span> <span class="nx">h</span><span class="p">);</span> <span class="nx">push</span><span class="p">(</span><span class="nx">centers</span><span class="p">,</span> <span class="nx">yC</span> <span class="o">-</span> <span class="nx">h</span><span class="p">)</span>
      <span class="nx">push</span><span class="p">(</span><span class="nx">centers</span><span class="p">,</span> <span class="nx">xC</span> <span class="o">-</span> <span class="nx">h</span><span class="p">);</span> <span class="nx">push</span><span class="p">(</span><span class="nx">centers</span><span class="p">,</span> <span class="nx">yC</span> <span class="o">-</span> <span class="nx">h</span><span class="p">)</span>
      <span class="nx">push</span><span class="p">(</span><span class="nx">centers</span><span class="p">,</span> <span class="nx">xC</span> <span class="o">-</span> <span class="nx">h</span><span class="p">);</span> <span class="nx">push</span><span class="p">(</span><span class="nx">centers</span><span class="p">,</span> <span class="nx">yC</span> <span class="o">-</span> <span class="nx">h</span><span class="p">)</span>
      <span class="nx">push</span><span class="p">(</span><span class="nx">centers</span><span class="p">,</span> <span class="nx">xC</span> <span class="o">-</span> <span class="nx">h</span><span class="p">);</span> <span class="nx">push</span><span class="p">(</span><span class="nx">centers</span><span class="p">,</span> <span class="nx">yC</span> <span class="o">-</span> <span class="nx">h</span><span class="p">)</span>

      <span class="c1">// indices</span>
      <span class="kr">const</span> <span class="nx">k</span> <span class="o">=</span> <span class="p">(</span><span class="nx">i</span> <span class="o">*</span> <span class="nx">n</span> <span class="o">+</span> <span class="nx">j</span><span class="p">)</span> <span class="o">*</span> <span class="mi">4</span>
      <span class="nx">push</span><span class="p">(</span><span class="nx">indices</span><span class="p">,</span> <span class="nx">k</span><span class="p">);</span> <span class="nx">push</span><span class="p">(</span><span class="nx">indices</span><span class="p">,</span> <span class="nx">k</span> <span class="o">+</span> <span class="mi">1</span><span class="p">);</span> <span class="nx">push</span><span class="p">(</span><span class="nx">indices</span><span class="p">,</span> <span class="nx">k</span> <span class="o">+</span> <span class="mi">2</span><span class="p">)</span>
      <span class="nx">push</span><span class="p">(</span><span class="nx">indices</span><span class="p">,</span> <span class="nx">k</span><span class="p">);</span> <span class="nx">push</span><span class="p">(</span><span class="nx">indices</span><span class="p">,</span> <span class="nx">k</span> <span class="o">+</span> <span class="mi">2</span><span class="p">);</span> <span class="nx">push</span><span class="p">(</span><span class="nx">indices</span><span class="p">,</span> <span class="nx">k</span> <span class="o">+</span> <span class="mi">3</span><span class="p">)</span>
    <span class="p">}</span>
  <span class="p">}</span>

  <span class="c1">// 着色器内的变量名是单数形式，将复数形式的数组名与其对应起来</span>
  <span class="k">return</span> <span class="p">{</span>
    <span class="nx">pos</span><span class="o">:</span> <span class="nx">positions</span><span class="p">,</span>
    <span class="nx">center</span><span class="o">:</span> <span class="nx">centers</span><span class="p">,</span>
    <span class="nx">texCoord</span><span class="o">:</span> <span class="nx">texCoords</span><span class="p">,</span>
    <span class="nx">index</span><span class="o">:</span> <span class="nx">indices</span>
  <span class="p">}</span>
<span class="p">}</span>
</code></pre></div><p>现在我们已经能把原图拆分为一堆小矩形来渲染了。但这样还不够，因为默认情况下这些小矩形都是连接在一起的。借鉴一般游戏中粒子系统的实现，我们可以<b>把动画算法写到着色器里，只逐帧更新一个随时间递增的数字，让 GPU 推算出每个粒子不同时间应该在哪</b>。配套的着色器实现如下：</p><div class="highlight"><pre><code class="language-glsl"><span></span><span class="cm">/* 这是顶点着色器，片元着色器无须改动 */</span>

<span class="k">attribute</span> <span class="kt">vec4</span> <span class="n">pos</span><span class="p">;</span>
<span class="k">attribute</span> <span class="kt">vec4</span> <span class="n">center</span><span class="p">;</span>
<span class="k">attribute</span> <span class="kt">vec2</span> <span class="n">texCoord</span><span class="p">;</span>

<span class="k">uniform</span> <span class="kt">mat4</span> <span class="n">viewMat</span><span class="p">;</span>
<span class="k">uniform</span> <span class="kt">mat4</span> <span class="n">projectionMat</span><span class="p">;</span>
<span class="k">uniform</span> <span class="kt">mat4</span> <span class="n">rotateMat</span><span class="p">;</span>
<span class="k">uniform</span> <span class="kt">float</span> <span class="n">iTime</span><span class="p">;</span>

<span class="k">varying</span> <span class="kt">vec2</span> <span class="n">vTexCoord</span><span class="p">;</span>
<span class="k">const</span> <span class="kt">vec3</span> <span class="n">camera</span> <span class="o">=</span> <span class="kt">vec3</span><span class="p">(</span><span class="mo">0</span><span class="p">,</span> <span class="mo">0</span><span class="p">,</span> <span class="mi">1</span><span class="p">);</span>

<span class="c1">// 伪随机数生成器</span>
<span class="kt">float</span> <span class="n">rand</span><span class="p">(</span><span class="kt">vec2</span> <span class="n">co</span><span class="p">)</span> <span class="p">{</span>
  <span class="k">return</span> <span class="n">fract</span><span class="p">(</span><span class="n">sin</span><span class="p">(</span><span class="n">dot</span><span class="p">(</span><span class="n">co</span><span class="p">,</span> <span class="kt">vec2</span><span class="p">(</span><span class="mf">12.9898</span><span class="p">,</span> <span class="mf">78.233</span><span class="p">)))</span> <span class="o">*</span> <span class="mf">43758.5453</span><span class="p">);</span>
<span class="p">}</span>

<span class="kt">void</span> <span class="n">main</span><span class="p">()</span> <span class="p">{</span>
  <span class="c1">// 求出粒子相对于相机位置的单位方向向量，并附带上伪随机数的扰动</span>
  <span class="kt">vec3</span> <span class="n">dir</span> <span class="o">=</span> <span class="n">normalize</span><span class="p">(</span><span class="n">center</span><span class="p">.</span><span class="n">xyz</span> <span class="o">*</span> <span class="n">rand</span><span class="p">(</span><span class="n">center</span><span class="p">.</span><span class="n">xy</span><span class="p">)</span> <span class="o">-</span> <span class="n">camera</span><span class="p">);</span>
  <span class="c1">// 沿扰动后的方向，随时间递增偏移量</span>
  <span class="kt">vec3</span> <span class="n">translatedPos</span> <span class="o">=</span> <span class="n">pos</span><span class="p">.</span><span class="n">xyz</span> <span class="o">+</span> <span class="n">dir</span> <span class="o">*</span> <span class="n">iTime</span><span class="p">;</span>

  <span class="c1">// 给纹理坐标插值</span>
  <span class="n">vTexCoord</span> <span class="o">=</span> <span class="n">texCoord</span><span class="p">;</span>
  <span class="c1">// 求出矩阵变换后最终的顶点位置</span>
  <span class="nb">gl_Position</span> <span class="o">=</span> <span class="n">projectionMat</span> <span class="o">*</span> <span class="n">viewMat</span> <span class="o">*</span> <span class="kt">vec4</span><span class="p">(</span><span class="n">translatedPos</span><span class="p">,</span> <span class="mi">1</span><span class="p">);</span>
<span class="p">}</span>
</code></pre></div><p>由于进入了 3D 世界，因此这个着色器引入了经典的 MVP 矩阵变换。这其实也已经远离了本文的主题，相信感兴趣的同学一定不难找到入门资料学习掌握。这个粒子效果的 Demo 如下所示。这里我们特意降低了粒子数量，方便大家看清它是怎么一回事：</p><figure data-size="normal"><img src="https://pic1.zhimg.com/v2-16aeb1fa69eb23103aec96a40ce02c74_b.gif" data-caption="" data-size="normal" data-rawwidth="468" data-rawheight="334" data-thumbnail="https://pic1.zhimg.com/v2-16aeb1fa69eb23103aec96a40ce02c74_b.jpg" class="origin_image zh-lightbox-thumb" width="468" data-original="https://pic1.zhimg.com/v2-16aeb1fa69eb23103aec96a40ce02c74_r.jpg"></figure><p><br></p><p>如果基于 CSS，只要有了几百个 DOM 元素要高频更新，渲染时就会显得力不从心。而相比之下基于 WebGL，稳定 60 帧更新几万个粒子是完全不成问题的。由此可见，在与图像处理相关的特效层面，WebGL 始终是有它的用武之地的。</p><p>这一步的例子，可以在 <a href="http://link.zhihu.com/?target=https%3A//doodlewind.github.io/beam/examples.html%23effects/image-explode" class=" wrap external" target="_blank" rel="nofollow noreferrer">Image Explode</a> 这里访问到。</p><h2>如何封装自定渲染器</h2><p>最后，我们将视野回到前端工程，简单聊聊如何封装自己的渲染器。</p><p>Beam 自身不是一个 WebGL 渲染器或渲染引擎，而是方便大家编写渲染逻辑的通用基础库。当我们想要进一步复用渲染逻辑的时候，封装出自己的 WebGL 渲染器就显得必要了。</p><p>这里用 JS 中最为标准化的 class，演示如何封装出一个简单的滤镜渲染器：</p><div class="highlight"><pre><code class="language-js"><span></span><span class="kr">class</span> <span class="nx">FilterRenderer</span> <span class="p">{</span>
  <span class="nx">constructor</span> <span class="p">(</span><span class="nx">canvas</span><span class="p">)</span> <span class="p">{</span>
    <span class="k">this</span><span class="p">.</span><span class="nx">beam</span> <span class="o">=</span> <span class="k">new</span> <span class="nx">Beam</span><span class="p">(</span><span class="nx">canvas</span><span class="p">)</span>
    <span class="k">this</span><span class="p">.</span><span class="nx">shader</span> <span class="o">=</span> <span class="k">this</span><span class="p">.</span><span class="nx">beam</span><span class="p">(</span><span class="nx">MyShader</span><span class="p">)</span>
    <span class="k">this</span><span class="p">.</span><span class="nx">rect</span> <span class="o">=</span> <span class="nx">createRect</span><span class="p">()</span>
    <span class="k">this</span><span class="p">.</span><span class="nx">textures</span> <span class="o">=</span> <span class="k">this</span><span class="p">.</span><span class="nx">beam</span><span class="p">.</span><span class="nx">resource</span><span class="p">(</span><span class="nx">Textures</span><span class="p">)</span>
    <span class="k">this</span><span class="p">.</span><span class="nx">uniforms</span> <span class="o">=</span> <span class="k">this</span><span class="p">.</span><span class="nx">beam</span><span class="p">.</span><span class="nx">resource</span><span class="p">(</span><span class="nx">Uniforms</span><span class="p">,</span> <span class="p">{</span>
      <span class="nx">strength</span><span class="o">:</span> <span class="mi">0</span>
    <span class="p">})</span>
  <span class="p">}</span>

  <span class="nx">setStrength</span> <span class="p">(</span><span class="nx">strength</span><span class="p">)</span> <span class="p">{</span>
    <span class="k">this</span><span class="p">.</span><span class="nx">uniforms</span><span class="p">.</span><span class="nx">set</span><span class="p">(</span><span class="s1">'strength'</span><span class="p">,</span> <span class="nx">strength</span><span class="p">)</span>
  <span class="p">}</span>

  <span class="nx">setImage</span> <span class="p">(</span><span class="nx">image</span><span class="p">)</span> <span class="p">{</span>
    <span class="k">this</span><span class="p">.</span><span class="nx">textures</span><span class="p">.</span><span class="nx">set</span><span class="p">(</span><span class="s1">'img'</span><span class="p">,</span> <span class="p">{</span> <span class="nx">image</span><span class="p">,</span> <span class="nx">flip</span><span class="o">:</span> <span class="kc">true</span> <span class="p">})</span>
  <span class="p">}</span>

  <span class="nx">render</span> <span class="p">()</span> <span class="p">{</span>
    <span class="kr">const</span> <span class="p">{</span> <span class="nx">beam</span><span class="p">,</span> <span class="nx">shader</span><span class="p">,</span> <span class="nx">rect</span><span class="p">,</span> <span class="nx">textures</span><span class="p">,</span> <span class="nx">uniforms</span> <span class="p">}</span> <span class="o">=</span> <span class="k">this</span>
    <span class="nx">beam</span>
      <span class="p">.</span><span class="nx">clear</span><span class="p">()</span>
      <span class="p">.</span><span class="nx">draw</span><span class="p">(</span><span class="nx">shader</span><span class="p">,</span> <span class="nx">rect</span><span class="p">,</span> <span class="nx">textures</span><span class="p">,</span> <span class="nx">uniforms</span><span class="p">)</span>
  <span class="p">}</span>
<span class="p">}</span>
</code></pre></div><p>只要这样，在使用时就可以完全把 Beam 的 WebGL 概念屏蔽掉了：</p><div class="highlight"><pre><code class="language-js"><span></span><span class="kr">const</span> <span class="nx">renderer</span> <span class="o">=</span> <span class="k">new</span> <span class="nx">FilterRenderer</span><span class="p">(</span><span class="nx">canvas</span><span class="p">)</span>
<span class="nx">renderer</span><span class="p">.</span><span class="nx">setImage</span><span class="p">(</span><span class="nx">myImage</span><span class="p">)</span>
<span class="nx">renderer</span><span class="p">.</span><span class="nx">setStrength</span><span class="p">(</span><span class="mi">1</span><span class="p">)</span>
<span class="nx">renderer</span><span class="p">.</span><span class="nx">render</span><span class="p">()</span>
</code></pre></div><p>这时值得注意的地方有这么几个：</p><ul><li>尽量在构造器对应的初始化阶段分配好资源</li><li>尽量不要高频更新大段的 Buffer 数据</li><li>不用的纹理和 Buffer 等资源要手动用 <code>destroy</code> 方法销毁掉</li></ul><p>当然，JS 中的 class 也不完美，而新兴的 Hooks 等范式也有潜力应用到这一领域，实现更好的 WebGL 工程化设计。该如何根据实际需求，定制出自己的渲染器呢？这就要看大家的口味和追求啦。</p><h2>后记</h2><p>为了尽量将各种重要的 WebGL 技巧浓缩在一起，快速达到足够实用的程度，本文篇幅显得有些长。虽然 Beam 的入门相对于 Vue 和 React 这样的常见框架来说还是有些门槛，但相比于一般需要分许多篇连载才能覆盖图像处理和离屏渲染的 WebGL 教程来说，我们已经屏蔽掉许多初学时不必关心的琐碎细节了。也欢迎大家对这种行文方式的反馈。</p><p>值得一提的是，Beam 不是一个为图像处理而生的库，API 中也没有为这个场景做任何特殊定制。它的设计初衷，其实是作为我司 3D 文字功能的渲染器。但由于它的 WebGL 基础库定位，它在 10KB 不到的体积下，不仅能平滑地从 3D 应用到 2D，甚至在 2D 场景下的扩展性，还能轻松超过 glfx.js 这样尚不支持滤镜链的社区标杆。这也反映出了设计框架时常有的两种思路：<b>一种是为每个新需求来者不拒地设计新的 API，将框架实现得包罗万象；另一种是谨慎地找到需求间的共性，实现最小的 API 子集供使用者组合定制</b>。显然笔者更倾向于后者。</p><p>Beam 的后续发展，也需要大家的支持——其实只要你不吝于给它个 Star 就够了。这会给我们更大的动力继续争取资源来维护它，或者进一步分享更多的 WebGL 知识与经验。欢迎大家移步这里：</p><a href="http://link.zhihu.com/?target=https%3A//github.com/doodlewind/beam" data-draft-node="block" data-draft-type="link-card" class=" wrap external" target="_blank" rel="nofollow noreferrer">Beam - Expressive WebGL</a><p>到此为止，相信我们已经对 WebGL 在图像处理领域的基本应用有了代码层面的认识了。希望大家对日常遇到的技术能少些「这么底层我管不来，用别人封装的东西就好」的心态，保持对舒适区外技术的学习热情，为自主创新贡献自己哪怕是微小的一份力量。</p>