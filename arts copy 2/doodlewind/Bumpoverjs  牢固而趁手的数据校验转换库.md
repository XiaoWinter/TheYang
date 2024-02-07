<p data-pid="kEwCAhOo"><a href="http://link.zhihu.com/?target=https%3A//github.com/doodlewind/bumpover" class=" wrap external" target="_blank" rel="nofollow noreferrer">Bumpover</a> 能帮助你编写出简洁明了的数据校验与转换代码。通过熟悉的<b>类型注解 API</b> 与<b>声明式的转换规则</b>，你可以轻松地在<b>运行期</b>校验未知的数据，并将其转换为自己可控的格式。</p><p data-pid="MKgtmKxJ">稳定的数据结构对应用至关重要，但在持续的需求变更和版本迭代中，数据格式<b>总是</b>处于频繁的变动之中。你当然可以编写更多的 if else 逻辑来兼容不同类型的数据，不过这显然会带来更多枯燥、随意而危险的面条代码。有没有更好的方式呢？</p><p data-pid="rSj_KIr-">现在，TypeScript 和 Flow 已经为我们带来了非常方便的类型声明 API，可以帮助你在<b>编译期</b>检测出潜在的类型问题。不过对于<b>运行期</b>未知的数据 - 如源自后端接口、文件系统和剪贴板粘贴的数据 - 它们的作用也相对有限：想想上次对接后端接口的时候你调了多久？</p><p data-pid="TjfSe9H-">并且，在一般意义上的数据校验之外，数据的转换与迁移也是日常开发中非常常见的场景。除了数据可视化这样需要频繁转换数据结构的场景外，对于一些将复杂 JSON 或 XML 内容序列化为字符串后存储在关系型数据库中的数据，它们在数据结构变动时，清洗起来是相当困难的：完成一道把 <code>'&lt;p&gt;123&lt;/p&gt;'</code> 解析成 <code>{ paragraph: 123 }</code> 的面试题是一回事，保证稳定可预期的数据转换就是另一回事了。</p><p data-pid="hs2G333R">Bumpover 就是设计来解决上面这几个问题的。它通过结合来自 <a href="http://link.zhihu.com/?target=https%3A//github.com/ianstormtaylor/superstruct" class=" wrap external" target="_blank" rel="nofollow noreferrer">Superstruct</a> 的类型声明和规则驱动的数据更新机制，实现了：</p><ul><li data-pid="u1jgcDo2">对 JSON 与 XML 格式数据声明式的校验 - 类似 JSON Schema，但轻便灵活得多。</li><li data-pid="w2cGomAi">友好的类型注解 API，支持递归定义的数据类型。</li><li data-pid="TMorNcml">基于 Promise 的数据节点更新规则，可异步转换存在外部依赖的数据。</li><li data-pid="-cBcfTfS">灵活的数据遍历机制，允许全量保留子节点、过滤未知节点等。</li><li data-pid="O84t-uGL">可插拔的序列化和反序列化器，可轻松地支持各类私有数据格式。</li></ul><p data-pid="5TbLkGRZ">说了这么多，那么 Bumpover 到底如何使用呢？耽误你一分钟的时间就够了：</p><blockquote data-pid="u_agiaur">开始前，记得安装依赖 :-)</blockquote><div class="highlight"><pre><code class="language-text"><span></span>npm install --save bumpover superstruct 
</code></pre></div><p data-pid="7yT0Mi4V">将 Bumpover 与 Superstruct 导入到代码库中：</p><div class="highlight"><pre><code class="language-js"><span></span><span class="kr">import</span> <span class="p">{</span> <span class="nx">Bumpover</span> <span class="p">}</span> <span class="nx">from</span> <span class="s1">'bumpover'</span>
<span class="kr">import</span> <span class="p">{</span> <span class="nx">struct</span> <span class="p">}</span> <span class="nx">from</span> <span class="s1">'superstruct'</span>
</code></pre></div><p data-pid="DSRgfJY8">假设这个场景：你有一份数据，其内容可能是虚拟 DOM 树中的节点，格式长这样：</p><div class="highlight"><pre><code class="language-js"><span></span><span class="kr">const</span> <span class="nx">maybeNode</span> <span class="o">=</span> <span class="p">{</span>
  <span class="nx">name</span><span class="o">:</span> <span class="s1">'div'</span><span class="p">,</span>
  <span class="nx">props</span><span class="o">:</span> <span class="p">{</span> <span class="nx">background</span><span class="o">:</span> <span class="s1">'red'</span> <span class="p">},</span>
  <span class="nx">children</span><span class="o">:</span> <span class="p">[]</span>
<span class="p">}</span>
</code></pre></div><p data-pid="iD-8Mgmi">我们可以定义一个 struct 来校验它：</p><div class="highlight"><pre><code class="language-js"><span></span><span class="kr">import</span> <span class="p">{</span> <span class="nx">struct</span> <span class="p">}</span> <span class="nx">from</span> <span class="s1">'superstruct'</span>

<span class="kr">const</span> <span class="nx">Node</span> <span class="o">=</span> <span class="nx">struct</span><span class="p">({</span>
  <span class="nx">name</span><span class="o">:</span> <span class="s1">'string'</span><span class="p">,</span>
  <span class="nx">props</span><span class="o">:</span> <span class="s1">'object?'</span><span class="p">,</span>
  <span class="nx">children</span><span class="o">:</span> <span class="s1">'array'</span>
<span class="p">})</span>
</code></pre></div><p data-pid="qTjcXF8v">现在我们就能用 <code>Node</code> 来校验数据啦，将其作为函数调用即可：</p><div class="highlight"><pre><code class="language-js"><span></span><span class="nx">Node</span><span class="p">(</span><span class="nx">maybeNode</span><span class="p">)</span>
</code></pre></div><p data-pid="sHL9SvjU">一旦数据校验失败，你会获得详细的错误信息，而成功时会返回校验后的数据。</p><p data-pid="qh-X_p23">现在如果我们需要转换这份数据，该怎么做呢？比如，如果我们需要把所有的 <code>div</code> 标签换成 <code>span</code>标签，并保留其它节点，该怎样可靠地实现呢？你可以过程式地人肉遍历数据，或者，简单地定义<b>规则</b>：</p><div class="highlight"><pre><code class="language-js"><span></span><span class="kr">import</span> <span class="p">{</span> <span class="nx">Bumpover</span> <span class="p">}</span> <span class="nx">from</span> <span class="s1">'bumpover'</span>

<span class="kr">const</span> <span class="nx">rules</span> <span class="o">=</span> <span class="p">[</span>
  <span class="p">{</span>
    <span class="nx">match</span><span class="o">:</span> <span class="nx">node</span> <span class="p">=&gt;</span> <span class="nx">node</span><span class="p">.</span><span class="nx">name</span> <span class="o">===</span> <span class="s1">'div'</span><span class="p">,</span>
    <span class="nx">update</span><span class="o">:</span> <span class="nx">node</span> <span class="p">=&gt;</span> <span class="k">new</span> <span class="nb">Promise</span><span class="p">((</span><span class="nx">resolve</span><span class="p">,</span> <span class="nx">reject</span><span class="p">)</span> <span class="p">=&gt;</span> <span class="p">{</span>
      <span class="nx">resolve</span><span class="p">({</span>
        <span class="nx">node</span><span class="o">:</span> <span class="p">{</span> <span class="p">...</span><span class="nx">node</span><span class="p">,</span> <span class="nx">name</span><span class="o">:</span> <span class="s1">'span'</span> <span class="p">}</span>
      <span class="p">})</span>
    <span class="p">})</span>
  <span class="p">}</span>
<span class="p">]</span>

<span class="kr">const</span> <span class="nx">bumper</span> <span class="o">=</span> <span class="k">new</span> <span class="nx">Bumpover</span><span class="p">(</span><span class="nx">rules</span><span class="p">)</span>
<span class="nx">bumper</span><span class="p">.</span><span class="nx">bump</span><span class="p">(</span><span class="nx">data</span><span class="p">).</span><span class="nx">then</span><span class="p">(</span><span class="nx">console</span><span class="p">.</span><span class="nx">log</span><span class="p">)</span>

<span class="c1">// 获得新节点数据</span>
</code></pre></div><p data-pid="4h9Q-ppa">只要提供规则，bumpover 就会帮助你处理好剩下的脏活。注意下面几点就够了：</p><ul><li data-pid="_IWGI2zD">Rules 规则是实现转换逻辑的 Single Source of Truth。</li><li data-pid="eNuyJaFC">使用 <code>rule.match</code> 匹配节点。</li><li data-pid="NXLQcf-u">使用 <code>rule.update</code> 在 Promise 内更新节点，这带来了对异步更新的支持：对一份富文本 XML 数据，在做数据迁移时可能需要将其中 <code>&lt;img&gt;</code> 标签里的图片链接重新上传到云端，成功后再将新的链接写入新的数据结构中。Bumpover 能很好地支持这样的异步更新。</li><li data-pid="nH86fldP">将新节点包装在 <code>node</code> 字段内 resolve 即可。</li></ul><p data-pid="mzY4nEJo">这就是最基础的示例了！对于更新后获得的数据，你还可以为每条规则提供 <code>rule.struct</code> 字段，校验转换得到的新节点是否符合你的预期。</p><p data-pid="cK3cJfB-">转换简单的 JS 对象数据还不能完全体现出 Bumpover 的强大之处。考虑另一个场景：前端对 XML 格式数据的处理，一直缺乏易用的 API。除了原生 DOM 诡异的接口外，sax 这样基于流的处理方式也十分沉重。而 Bumpover 则提供了开箱即用的 <code>XMLBumpover</code> 可以帮助你。同样是把 <code>&lt;div&gt;</code> 转换为 <code>&lt;span&gt;</code> 标签，对 JSON 和 XML 格式数据的转换规则<b>完全一致</b>！</p><div class="highlight"><pre><code class="language-js"><span></span><span class="kr">import</span> <span class="p">{</span> <span class="nx">XMLBumpover</span> <span class="p">}</span> <span class="nx">from</span> <span class="s1">'bumpover'</span>

<span class="kr">const</span> <span class="nx">rules</span> <span class="o">=</span> <span class="p">[</span>
  <span class="p">{</span>
    <span class="nx">match</span><span class="o">:</span> <span class="nx">node</span> <span class="p">=&gt;</span> <span class="nx">node</span><span class="p">.</span><span class="nx">name</span> <span class="o">===</span> <span class="s1">'div'</span><span class="p">,</span>
    <span class="nx">update</span><span class="o">:</span> <span class="nx">node</span> <span class="p">=&gt;</span> <span class="k">new</span> <span class="nb">Promise</span><span class="p">((</span><span class="nx">resolve</span><span class="p">,</span> <span class="nx">reject</span><span class="p">)</span> <span class="p">=&gt;</span> <span class="p">{</span>
      <span class="nx">resolve</span><span class="p">({</span>
        <span class="nx">node</span><span class="o">:</span> <span class="p">{</span> <span class="p">...</span><span class="nx">node</span><span class="p">,</span> <span class="nx">name</span><span class="o">:</span> <span class="s1">'span'</span> <span class="p">}</span>
      <span class="p">})</span>
    <span class="p">})</span>
  <span class="p">}</span>
<span class="p">]</span>

<span class="kr">const</span> <span class="nx">input</span> <span class="o">=</span> <span class="sb">`</span>
<span class="sb">&lt;div&gt;</span>
<span class="sb">  &lt;div&gt;demo&lt;/div&gt;</span>
<span class="sb">&lt;/div&gt;</span>
<span class="sb">`</span>

<span class="kr">const</span> <span class="nx">bumper</span> <span class="o">=</span> <span class="k">new</span> <span class="nx">XMLBumpover</span><span class="p">(</span><span class="nx">rules</span><span class="p">)</span>
<span class="nx">bumper</span><span class="p">.</span><span class="nx">bump</span><span class="p">(</span><span class="nx">input</span><span class="p">).</span><span class="nx">then</span><span class="p">(</span><span class="nx">console</span><span class="p">.</span><span class="nx">log</span><span class="p">)</span>

<span class="c1">// '&lt;span&gt;&lt;span&gt;demo&lt;/span&gt;&lt;/span&gt;'</span>
</code></pre></div><p data-pid="7Og_wzSA">这背后有什么黑魔法呢？不存在的。对于你自己的各种神奇的数据格式，<b>只要你能提供它与 JSON 互相转换的 Parser，你就能编写同样的 Bumpover 规则来校验并转换它</b>。作为例子，Bumpover 还提供了一个 <code>JSONBumpover</code> 类，能够处理 JSON 字符串。我们来看看它的实现源码：</p><div class="highlight"><pre><code class="language-js"><span></span><span class="kr">import</span> <span class="p">{</span> <span class="nx">Bumpover</span> <span class="p">}</span> <span class="nx">from</span> <span class="s1">'./index'</span>

<span class="kr">export</span> <span class="kr">class</span> <span class="nx">JSONBumpover</span> <span class="kr">extends</span> <span class="nx">Bumpover</span> <span class="p">{</span>
  <span class="nx">constructor</span> <span class="p">(</span><span class="nx">rules</span><span class="p">,</span> <span class="nx">options</span><span class="p">)</span> <span class="p">{</span>
    <span class="kr">super</span><span class="p">(</span><span class="nx">rules</span><span class="p">,</span> <span class="nx">options</span><span class="p">)</span>
    <span class="k">this</span><span class="p">.</span><span class="nx">options</span> <span class="o">=</span> <span class="p">{</span>
      <span class="p">...</span><span class="k">this</span><span class="p">.</span><span class="nx">options</span><span class="p">,</span>
      <span class="nx">serializer</span><span class="o">:</span> <span class="nx">JSON</span><span class="p">.</span><span class="nx">stringify</span><span class="p">,</span>
      <span class="nx">deserializer</span><span class="o">:</span> <span class="nx">JSON</span><span class="p">.</span><span class="nx">parse</span>
    <span class="p">}</span>
  <span class="p">}</span>
<span class="p">}</span>
</code></pre></div><p data-pid="F-7MPi1-">只要提供了 <code>JSON.parse</code> 和 <code>JSON.stringify</code>，你就能支持一种全新的数据类型了。并且，你还可以把 <code>xml2js</code> 和 <code>JSON.stringify</code> 相结合，定制出更灵活的数据转换器 ?</p><p data-pid="1kYCQ7tQ">如果这些实例让你有了点兴趣，Bumpover 项目下还有一份完整的 <a href="http://link.zhihu.com/?target=https%3A//github.com/doodlewind/bumpover/blob/master/docs/walkthrough.md" class=" wrap external" target="_blank" rel="nofollow noreferrer">Walkthrough</a>，介绍如何使用 Bumpover 实现异步迁移、及早返回、过滤节点等更灵活的特性，辅以完整的 <a href="http://link.zhihu.com/?target=https%3A//github.com/doodlewind/bumpover/blob/master/docs/reference.md" class=" wrap external" target="_blank" rel="nofollow noreferrer">API 文档</a>。并且，Bumpover 虽然才开始开发不到一周，但已经实现了测试用例的 <b>100% 代码覆盖率</b>，欢迎感兴趣的同学前来体验哦 ?</p><p data-pid="m49--3ku">最后作为一点花絮，介绍一下笔者开发 Bumpover 的动机，以及它和 Superstruct 的渊源：Superstruct 与 <a href="http://link.zhihu.com/?target=https%3A//github.com/ianstormtaylor/slate" class=" wrap external" target="_blank" rel="nofollow noreferrer">Slate</a> 富文本编辑框架师出同门，而笔者本人恰好是这个编辑器的主要贡献者之一。Slate 在 <code>v0.30</code> 左右遇到了编辑器 Schema 校验的各种问题，而 Superstruct 就是一个应运而生，允许自定义更灵活 Schema 的新轮子。而笔者在实际使用中发现 Superstruct 还能够推广到更一般的场景下，这就是 Bumpover 诞生的源动力了。</p><p data-pid="zPi4VTP9"><a href="http://link.zhihu.com/?target=https%3A//github.com/doodlewind/bumpover" class=" wrap external" target="_blank" rel="nofollow noreferrer">Bumpover</a> 还处于非常早期的阶段，非常希望各位 dalao 们能够赏脸支持~谢谢！</p><ul><li data-pid="W5570enP"><a href="http://link.zhihu.com/?target=https%3A//github.com/doodlewind/bumpover" class=" wrap external" target="_blank" rel="nofollow noreferrer">Bumpover Repo</a></li><li data-pid="WOn6QJgm"><a href="http://link.zhihu.com/?target=https%3A//github.com/ianstormtaylor/superstruct" class=" wrap external" target="_blank" rel="nofollow noreferrer">Superstruct Repo</a></li><li data-pid="y3dCsD2T"><a href="http://link.zhihu.com/?target=https%3A//juejin.im/post/59e6fc9951882578d503952c" class=" wrap external" target="_blank" rel="nofollow noreferrer">Slate 介绍</a></li></ul>