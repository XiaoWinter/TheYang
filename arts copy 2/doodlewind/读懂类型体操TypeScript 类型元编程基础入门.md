<p data-pid="bOBCmtqY">现在，TypeScript 已经在前端圈获得了广泛的群众基础。但据个人观察，很多同学还处于刚刚脱离 AnyScript 的阶段，看到 K in keyof T 这类东西就头疼，读不懂现代前端框架中普遍使用的类型操作技巧。如果你也对类型体操感到一头雾水，本文或许能为你提供一些授人以渔式的帮助。</p><p data-pid="XWL7Blte">由于本文预期的受众是完全没有高级类型操作经验的同学，因此下面我们不会直接列出一堆复杂的类型体操案例，而是从最简单的泛型变量语法等基础知识开始，逐步展示该如何从零到一地使用 TS 中强大的 type-level 编程能力。这些内容可以依次分成三个部分：</p><ul><li data-pid="6F7Sl5pA">循环依赖与类型空间</li><li data-pid="wvyx5y9M">类型空间与类型变量</li><li data-pid="ZDg1CZ0D">类型变量与类型体操</li></ul><blockquote data-pid="st0Sdu9x">如果你已经完成了 TypeScript 入门（能顺利解答 <a href="http://link.zhihu.com/?target=https%3A//github.com/type-challenges/type-challenges/" class=" wrap external" target="_blank" rel="nofollow noreferrer">type-challenges</a> 中的 Easy 难度问题），那么本文对你来说应该过于简单，不需要阅读。 </blockquote><p data-pid="q1ntLSzZ">在开始介绍具体的类型操作语法前，这里希望先铺垫个例子，借此先理清楚「<b>TypeScript 相比于 JavaScript 到底扩展出了什么东西</b>」，这对后面建立思维模型会很有帮助。</p><h2>循环依赖与类型空间</h2><p data-pid="lZ-P7N2Z">我们都知道，JavaScript 中是不建议存在循环依赖的。假如我们为一个编辑器拆分出了 Editor 和 Element 两个 class，并把它们分别放在 <code>editor.js</code> 和 <code>element.js</code> 里，那么这两个模块不应该互相 import 对方。也就是说，下面这种形式是不提倡的：</p><div class="highlight"><pre><code class="language-js"><span></span><span class="c1">// editor.js</span>
<span class="kr">import</span> <span class="p">{</span> <span class="nx">Element</span> <span class="p">}</span> <span class="nx">from</span> <span class="s1">'./element'</span>

<span class="c1">// element.js</span>
<span class="kr">import</span> <span class="p">{</span> <span class="nx">Editor</span> <span class="p">}</span> <span class="nx">from</span> <span class="s1">'./editor'</span>
</code></pre></div><p data-pid="Q_RUPRgx">但是在 TypeScript 中，我们很可能必须使用这样的「循环依赖」。因为往往不仅在 Editor 实例里要装着 Element 的实例，每个 Element 实例里也需要有指回 Editor 的引用。由于类型标注的存在，我们就必须这么写：</p><div class="highlight"><pre><code class="language-ts"><span></span><span class="c1">// editor.ts</span>
<span class="kr">import</span> <span class="p">{</span> <span class="nx">Element</span> <span class="p">}</span> <span class="nx">from</span> <span class="s1">'./element'</span>

<span class="c1">// Editor 中需要建立 Element 实例</span>
<span class="kr">class</span> <span class="nx">Editor</span> <span class="p">{</span>
  <span class="kr">constructor</span><span class="p">()</span> <span class="p">{</span>
    <span class="k">this</span><span class="p">.</span><span class="nx">element</span> <span class="o">=</span> <span class="k">new</span> <span class="nx">Element</span><span class="p">();</span>
  <span class="p">}</span>
<span class="p">}</span>

<span class="c1">// element.ts</span>
<span class="kr">import</span> <span class="p">{</span> <span class="nx">Editor</span> <span class="p">}</span> <span class="nx">from</span> <span class="s1">'./editor'</span>

<span class="c1">// Element 中需要标注类型为 Editor 的属性</span>
<span class="kr">class</span> <span class="nx">Element</span> <span class="p">{</span>
  <span class="nx">editor</span>: <span class="kt">Editor</span>
<span class="p">}</span>
</code></pre></div><p data-pid="payT9X9T">这不就造成了 JS 中忌讳的循环引用了吗？当然这么写倒也不是不能用，因为这里为了类型标注而写的 <code>import</code> 不会出现在编译出的 JS 代码中（说粗俗点就是「编译以后就没了」，后面会详细解释）。但比较熟悉 TS 的同学应该都知道，这时的最佳实践是使用 <a href="http://link.zhihu.com/?target=https%3A//www.typescriptlang.org/docs/handbook/release-notes/typescript-3-8.html%23type-only-imports-and-export" class=" wrap external" target="_blank" rel="nofollow noreferrer">TypeScript 3.8</a> 中新增的 <code>import type</code> 语法：</p><div class="highlight"><pre><code class="language-ts"><span></span><span class="c1">// element.ts</span>
<span class="kr">import</span> <span class="nx">type</span> <span class="p">{</span> <span class="nx">Editor</span> <span class="p">}</span> <span class="nx">from</span> <span class="s1">'./editor'</span>

<span class="c1">// 这个 type 可以放心地用作类型标注，不造成循环引用</span>
<span class="kr">class</span> <span class="nx">Element</span> <span class="p">{</span>
  <span class="nx">editor</span>: <span class="kt">Editor</span>
<span class="p">}</span>

<span class="c1">// 但这里就不能这么写了，会报错</span>
<span class="kr">const</span> <span class="nx">editor</span> <span class="o">=</span> <span class="k">new</span> <span class="nx">Editor</span><span class="p">()</span>
</code></pre></div><p data-pid="bbdVXZbl">现在问题来了，<code>import type</code> 这个语法和普通的 <code>import</code> 有什么效果上的区别呢？基于这个语法导入的 Editor 到底又是什么呢？为什么这时的 Editor 不能拿来 <code>new</code> 呢？这时我们就需要知道类型空间的概念了。</p><p data-pid="h7E_rxCd">不同于使用动态类型的 JavaScript，像 TypeScript 这样的现代静态类型语言，一般都具备两个放置语言实体的「空间」，即类型空间（<i>type-level space</i>）和值空间（<i>value-level space</i>）。前者用于存放代码中的类型信息，在运行时会被完全擦除掉。而后者则存放了代码中的「值」，会保留到运行时。</p><p data-pid="_sKCy9tT">那么这里的「值」是什么呢？字面量、变量、常量、函数形参、函数对象、class、enum……它们都是值，因为这些实体在编译出的 JS 中都会保留下来。而相应地，类型空间中则存放着所有用 <code>type</code> 关键字定义的类型，以及 interface、class 和 enum——<b>也就是所有能拿来当作类型标注的东西</b>。</p><p data-pid="vEw7KQEA">注意到重复的地方了吗？没错，class 和 enum 是横跨两个空间的！这其实很好理解，比如对于一个名为 <code>Foo</code> 的 class，我们在写出 <code>let foo: Foo</code> 的时候，使用的是类型空间里的 <code>Foo</code>。而在写出 <code>let foo = new Foo()</code> 时，使用的则是值空间里的 <code>Foo</code>。因为前者会被擦除掉，后者会保留在 JS 里。</p><p data-pid="IVDgnyEB">只要明白这一点，上面的问题就全都迎刃而解了：这里的 <code>import type</code> 相当于只允许所导入的实体在类型空间使用，因此上面导入的 <code>Editor</code> 就被限定在了类型空间，从而杜绝了值空间（JS）中潜在的循环引用问题。</p><blockquote data-pid="GgOVoqc5">通俗地说，值空间在第一层，类型空间在第二层，<a href="https://zhuanlan.zhihu.com/p/65473609" class="internal">Anders</a> 老爷子在大气层。</blockquote><p data-pid="eNOJVTre">现在，我们已经通过对 <code>import type</code> 语法的观察，明白了 TypeScript 中实际上存在着两个不同的空间。那么在这个神秘的类型空间里，我们能做什么呢？有句老话说得好，广阔天地，大有可为。</p><h2>类型空间与类型变量</h2><p data-pid="Ig3h0hpC">显然，类型空间里容纳着的是各种各样的类型。而非常有趣的是，编程语言中的「常量」和「变量」概念在这里同样适用：</p><ul><li data-pid="QhDuwe0R">当我们写 <code>let x: number</code> 时，这个固定的 <code>number</code> 类型就是典型的常量。如果我们把某份 JSON 数据的字段结构写成朴素的 interface，那么这个 interface 也是类型空间里的常量。</li><li data-pid="6dflGqvX">在使用泛型时，我们会遇到类型空间里的变量。这里的「变」体现在哪里呢？举例来说，<b>通过泛型，函数的返回值类型可以由输入参数的类型决定</b>。如果纯粹依靠「写死」的常量来做类型标注，是做不到这一点的。</li></ul><p data-pid="Tb_FLHs4">在 TypeScript 中使用泛型的默认方式，相比 Java 和 C++ 这些（名字拼写）大家都很熟悉的经典语言，并没有什么区别。这里重要的地方并不是 <code>&lt;T&gt;</code> 形式的语法，而是这时我们<b>实际上是在类型空间中定义了一个类型变量</b>：</p><div class="highlight"><pre><code class="language-ts"><span></span><span class="c1">// 使用泛型标注的加法函数，这里的 Type 就是一个类型变量</span>
<span class="kd">function</span> <span class="nx">add</span><span class="o">&lt;</span><span class="nx">Type</span><span class="o">&gt;</span><span class="p">(</span><span class="nx">a</span>: <span class="kt">Type</span><span class="p">,</span> <span class="nx">b</span>: <span class="kt">Type</span><span class="p">)</span><span class="o">:</span> <span class="nx">Type</span> <span class="p">{</span>
  <span class="k">return</span> <span class="nx">a</span> <span class="o">+</span> <span class="nx">b</span><span class="p">;</span>
<span class="p">}</span>

<span class="nx">add</span><span class="p">(</span><span class="mi">1</span><span class="p">,</span> <span class="mi">2</span><span class="p">)</span> <span class="c1">// 返回值类型可被推断为 number</span>
<span class="nx">add</span><span class="p">(</span><span class="s1">'a'</span><span class="p">,</span> <span class="s1">'b'</span><span class="p">)</span> <span class="c1">// 返回值类型可被推断为 string</span>

<span class="nx">add</span><span class="p">(</span><span class="mi">1</span><span class="p">,</span> <span class="s1">'b'</span><span class="p">)</span> <span class="c1">// 形参类型不匹配，报错</span>
</code></pre></div><p data-pid="-EgVVI2p">在上面这个非常简单的例子里，通过 <code>Type</code> 这个类型变量，我们不仅在输入参数和返回值的类型之间建立了动态的联系，还在输入参数之间建立了约束，这是一种很强大的表达力。另外由于<b>这类变量在语义上几乎总是相当于占位符</b>，所以我们一般会把它们简写成 <code>T</code> / <code>U</code> / <code>V</code> 之类。</p><p data-pid="9LyRLHtI">除了声明类型变量以外，另一种能在类型空间里进行的重要操作，就是从一种类型推导出另一种类型。TypeScript 为此扩展出了自己定义的一套语法，比如一个非常典型的例子就是 <code>keyof</code> 运算符。这个运算符是专门在类型空间里使用的，（不太准确地说）相当于能在类型空间里做的 <code>Object.keys</code>，像这样：</p><div class="highlight"><pre><code class="language-ts"><span></span><span class="c1">// 定义一个表达坐标的 Point 结构</span>
<span class="kr">interface</span> <span class="nx">Point</span> <span class="p">{</span>
  <span class="nx">x</span>: <span class="kt">number</span>
  <span class="nx">y</span>: <span class="kt">number</span>
<span class="p">}</span>

<span class="c1">// 取出 Point 中全部 key 的并集</span>
<span class="nx">type</span> <span class="nx">PointKey</span> <span class="o">=</span> <span class="nx">keyof</span> <span class="nx">Point</span>

<span class="c1">// a 可以是任意一种 PointKey</span>
<span class="kd">let</span> <span class="nx">a</span>: <span class="kt">PointKey</span><span class="p">;</span>

<span class="nx">a</span> <span class="o">=</span> <span class="s1">'x'</span> <span class="c1">// 通过</span>
<span class="nx">a</span> <span class="o">=</span> <span class="s1">'y'</span> <span class="c1">// 通过</span>
<span class="nx">a</span> <span class="o">=</span> <span class="p">{</span> <span class="nx">x</span>: <span class="kt">0</span><span class="p">,</span> <span class="nx">y</span>: <span class="kt">0</span> <span class="p">}</span> <span class="c1">// 报错</span>
</code></pre></div><p data-pid="RukjAVIF">值得注意的是，<code>Object.keys</code> 返回的是一个数组，但 <code>keyof</code> 返回的则是一个集合。如果前者返回的是 <code>['x', 'y']</code> 数组，那么后者返回的就是 <code>'x' | 'y'</code> 集合。我们也可以用形如 <code>type C = A | B</code> 的语法来取并集，这时其实也是在类型空间进行了 <code>A | B</code> 的表达式运算。</p><p data-pid="VUE9syzc">除了 <code>keyof</code> 运算符以外，在类型空间编程时必备的还有泛型的 <code>extends</code> 关键字。它在这里的语义并非 class 和 interface 中的「继承」，而更类似于<b>由一个类型表达式来「约束」住另一个类型变量</b>：</p><div class="highlight"><pre><code class="language-ts"><span></span><span class="c1">// identity 就是返回原类型自身的简单函数</span>
<span class="c1">// 这里的 T 就相当于被标注成了 Point 类型</span>
<span class="kd">function</span> <span class="nx">identity1</span><span class="o">&lt;</span><span class="nx">T</span> <span class="kr">extends</span> <span class="nx">Point</span><span class="o">&gt;</span><span class="p">(</span><span class="nx">a</span>: <span class="kt">T</span><span class="p">)</span><span class="o">:</span> <span class="nx">T</span> <span class="p">{</span>
  <span class="k">return</span> <span class="nx">a</span><span class="p">;</span>
<span class="p">}</span>

<span class="c1">// 这里的 T 来自 Point2D | Point3D 这个表达式</span>
<span class="kd">function</span> <span class="nx">identity2</span><span class="o">&lt;</span><span class="nx">T</span> <span class="kr">extends</span> <span class="nx">Point2D</span> <span class="o">|</span> <span class="nx">Point3D</span><span class="o">&gt;</span><span class="p">(</span><span class="nx">a</span>: <span class="kt">T</span><span class="p">)</span><span class="o">:</span> <span class="nx">T</span> <span class="p">{</span>
  <span class="k">return</span> <span class="nx">a</span><span class="p">;</span>
<span class="p">}</span>
</code></pre></div><p data-pid="jHJkX6l5">现在，我们已经清楚地意识到了类型变量的存在，并且也知道我们能在类型空间里「<b>基于类型来生成新类型</b>」了。经过这个热身，你是不是已经按捺不住继续尝试体操动作的热情了呢？不过在继续往下之前，这里先总结一下这么几点吧：</p><ul><li data-pid="uYo74WwX">类型空间里同样可以存在变量，其运算结果还可以赋值给新的类型变量。实际上 TypeScript 早已做到让这种运算图灵完备了。</li><li data-pid="5Vy89YGp">类型空间里的运算始终只能针对类型空间里的实体，无法涉及运行时的值空间。比如从后端返回的 <code>data</code> 数据里到底有哪些字段，显然不可能在编译期的类型空间里用 <code>keyof</code> 获知。不要尝试表演超出生理极限的体操动作。</li><li data-pid="e8qGOXsV">类型空间在运行时会被彻底擦除，因此你哪怕完全不懂不碰它也能写出业务逻辑，这时就相当于回退到了 JavaScript。</li></ul><p data-pid="FJ_R_VbK">因此，TypeScript 看似简单的类型标注背后，其实是一门隐藏在类型空间里的强大编程语言。虽然目前我们还只涉及到了对其最基础的几种用法，但已经可以组合起来发挥出更大的威力了。下面将从一个实际例子出发，介绍在类型空间进行更进阶操作时的思路。</p><h2>类型变量与类型体操</h2><p data-pid="Z9vSjqIl">怎样的类型操作算是「类型体操」呢？充斥着 <code>T</code> / <code>U</code> / <code>V</code> 等类型变量的代码可能算是一种吧。由于这时我们做的已经是在类型空间里进行的元编程，必须承认这类代码常常是较为晦涩的。但这种能力很可能获得一些意想不到的好处，<b>甚至能对应用性能有所帮助</b>——你说什么？类型在运行时被通通擦除掉的 TypeScript，怎么可能帮助我们提升性能呢？</p><p data-pid="uvXpPB4G">现在，假设我们在开发一个支持多人实时协作的编辑器。这时一个非常基础的需求，就是要能够将操作（operation）序列化为可传输的数据，在各个用户的设备上分布式地应用这些操作。一般来说，这类数据的结构都是数据模型中某些字段的 diff 结果，我们可以像应用 git patch 那样地把它应用到数据模型上。而由于每次操作所更新的字段都完全随机，<b>为了保存历史记录，我们需要将更新前后的字段数据都一起存起来</b>，像这样：</p><div class="highlight"><pre><code class="language-js"><span></span><span class="kr">class</span> <span class="nx">History</span> <span class="p">{</span>
  <span class="nx">commit</span><span class="p">(</span><span class="nx">element</span><span class="p">,</span> <span class="nx">from</span><span class="p">,</span> <span class="nx">to</span><span class="p">)</span> <span class="p">{</span>
    <span class="c1">// ...</span>
  <span class="p">}</span>
<span class="p">}</span>

<span class="c1">// 更新单个字段</span>
<span class="nx">history</span><span class="p">.</span><span class="nx">commit</span><span class="p">(</span><span class="nx">element</span><span class="p">,</span> <span class="p">{</span> <span class="nx">left</span><span class="o">:</span> <span class="mi">0</span> <span class="p">},</span> <span class="p">{</span> <span class="nx">left</span><span class="o">:</span> <span class="mi">10</span> <span class="p">})</span>

<span class="c1">// 或者更新多个字段</span>
<span class="nx">history</span><span class="p">.</span><span class="nx">commit</span><span class="p">(</span>
  <span class="nx">element</span><span class="p">,</span>
  <span class="p">{</span> <span class="nx">left</span><span class="o">:</span> <span class="mi">5</span><span class="p">,</span> <span class="nx">top</span><span class="o">:</span> <span class="mi">5</span> <span class="p">},</span>
  <span class="p">{</span> <span class="nx">left</span><span class="o">:</span> <span class="mi">10</span><span class="p">,</span> <span class="nx">top</span><span class="o">:</span> <span class="mi">10</span> <span class="p">}</span>
<span class="p">)</span>
</code></pre></div><p data-pid="eUJJqHlg">基于工程经验，这个 <code>commit</code> 方法需要满足两个目标：</p><ul><li data-pid="EpyVlX4I">能够适配所有不同类型的 Element。</li><li data-pid="hzAf8-lF"><b>对每种 Element，调用方所能提交的字段格式要能够被约束住</b>。比如只允许为 TextElement 提交 <code>text</code> 字段，只允许为 ImageElement 提交 <code>src</code> 字段。</li></ul><p data-pid="4a0jayVk">对于这两条要求，在原生的 JavaScript 中我们该怎么做呢？由于 JavaScript 是弱类型语言，第一条要求可以容易地满足。但对于约束字段的第二条要求，则通常需要由运行时的校验逻辑来实现：</p><div class="highlight"><pre><code class="language-js"><span></span><span class="kr">class</span> <span class="nx">History</span> <span class="p">{</span>
  <span class="nx">commit</span><span class="p">(</span><span class="nx">element</span><span class="p">,</span> <span class="nx">from</span><span class="p">,</span> <span class="nx">to</span><span class="p">)</span> <span class="p">{</span>
    <span class="c1">// 要求所有 `from` 中的 key 都存在于 `to` 中</span>
    <span class="kr">const</span> <span class="nx">allKeyExists</span> <span class="o">=</span> <span class="nb">Object</span>
      <span class="p">.</span><span class="nx">keys</span><span class="p">(</span><span class="nx">from</span><span class="p">)</span>
      <span class="p">.</span><span class="nx">every</span><span class="p">(</span><span class="nx">key</span> <span class="p">=&gt;</span> <span class="o">!!</span><span class="nx">to</span><span class="p">[</span><span class="nx">key</span><span class="p">])</span>
    <span class="c1">// 要求 `from` 中的 key 长度和 `to` 一致</span>
    <span class="kr">const</span> <span class="nx">keySizeEqual</span> <span class="o">=</span> <span class="p">(</span>
      <span class="nb">Object</span><span class="p">.</span><span class="nx">keys</span><span class="p">(</span><span class="nx">from</span><span class="p">).</span><span class="nx">length</span> <span class="o">===</span> <span class="nb">Object</span><span class="p">.</span><span class="nx">keys</span><span class="p">(</span><span class="nx">to</span><span class="p">).</span><span class="nx">length</span>
    <span class="p">)</span>
    <span class="c1">// 仅当同时满足上面两条时才通过校验</span>
    <span class="k">if</span> <span class="p">(</span><span class="o">!</span><span class="p">(</span><span class="nx">allEeyExists</span> <span class="o">&amp;&amp;</span> <span class="nx">keySizeEqual</span><span class="p">))</span> <span class="p">{</span>
      <span class="k">throw</span> <span class="k">new</span> <span class="nb">Error</span><span class="p">(</span><span class="s1">'you fxxking idiot!'</span><span class="p">);</span>
    <span class="p">}</span>

    <span class="c1">// ...</span>
  <span class="p">}</span>
<span class="p">}</span>
</code></pre></div><p data-pid="F45juglq">显然，这是一个 O(N) 复杂度的算法，并且还无法涵盖更精细的逻辑。例如这段代码无法检查存在嵌套的字段，只能检查对象 key 的名称而忽略了 value 的类型，不能根据 Element 的类型来校验字段的有效性……诸如此类的校验如果越写越复杂，还有一种工程上的变通方案，那就是通过 <code>NODE_ENV</code> 之类的环境变量，将这类校验代码限制在开发版的 JS 包里，在打运行时包时由编译器优化掉，<a href="https://www.zhihu.com/question/423354684/answer/1522345440" class="internal">像 React 就做了这样的处理</a>。这些确实倒是也都能做，但是何苦呢？</p><p data-pid="qJZGdy9K">其实，通过上面介绍的几个 TypeScript 操作符，我们就可以将这类校验直接在编译期完成了。首先让我们来满足第一条的通用性要求：</p><div class="highlight"><pre><code class="language-ts"><span></span><span class="kr">interface</span> <span class="nx">ImageElement</span> <span class="p">{}</span>
<span class="kr">interface</span> <span class="nx">TextElement</span> <span class="p">{}</span>
<span class="c1">// 无需继承，可以直接通过类型运算来实现</span>
<span class="nx">type</span> <span class="nx">Element</span> <span class="o">=</span> <span class="nx">ImageElement</span> <span class="o">|</span> <span class="nx">TextElement</span>

<span class="kr">class</span> <span class="nx">History</span> <span class="p">{</span>
  <span class="c1">// 直接标注 Element 类型</span>
  <span class="nx">commit</span><span class="p">(</span><span class="nx">element</span>: <span class="kt">Element</span><span class="p">,</span> <span class="nx">from</span><span class="p">,</span> <span class="nx">to</span><span class="p">)</span> <span class="p">{</span>
    <span class="c1">// ...</span>
  <span class="p">}</span>
<span class="p">}</span>
</code></pre></div><p data-pid="Yuuf5vte">上面的代码没有用到任何黑魔法，这里就不赘述了。重点在于第二条，如何根据 Element 类型来约束字段呢？联想到上面的 <code>keyof</code> 操作符，<b>我们很容易在类型空间里取出 Element 的所有 key</b>，并且还可以类比 ES6 中的 <code>{ [x]: 123 }</code> 语法，构建出类型空间里的新结构：</p><div class="highlight"><pre><code class="language-ts"><span></span><span class="nx">type</span> <span class="nx">T</span> <span class="o">=</span> <span class="nx">keyof</span> <span class="nx">Element</span> <span class="c1">// T 为 'left' | 'top' 等字段的集合</span>

<span class="c1">// 将所有 T 的可选项作为 key</span>
<span class="c1">// 以 Element 中相应 value 的类型为 value</span>
<span class="c1">// 以此结构建立出一个新的类型变量</span>
<span class="nx">type</span> <span class="nx">MyElement1</span> <span class="o">=</span> <span class="p">{</span> <span class="p">[</span><span class="nx">K</span> <span class="k">in</span> <span class="nx">T</span><span class="p">]</span><span class="o">:</span> <span class="nx">Element</span><span class="p">[</span><span class="nx">K</span><span class="p">]</span> <span class="p">}</span>

<span class="c1">// 等价于这么写</span>
<span class="nx">type</span> <span class="nx">MyElement2</span> <span class="o">=</span> <span class="p">{</span> <span class="p">[</span><span class="nx">K</span> <span class="k">in</span> <span class="nx">keyof</span> <span class="nx">Element</span><span class="p">]</span><span class="o">:</span> <span class="nx">Element</span><span class="p">[</span><span class="nx">K</span><span class="p">]</span> <span class="p">}</span>

<span class="kd">let</span> <span class="nx">a</span>: <span class="kt">MyElement1</span> <span class="c1">// 可以提示出 a.left 等 Element 中的字段</span>
</code></pre></div><p data-pid="JOo8Ieqm">基于上面这些能力，我们就可以开始做体操动作了！首先我们在方法定义里引入泛型变量：</p><div class="highlight"><pre><code class="language-ts"><span></span><span class="kr">class</span> <span class="nx">History</span> <span class="p">{</span>
  <span class="nx">commit</span><span class="o">&lt;</span><span class="nx">T</span> <span class="kr">extends</span> <span class="nx">Element</span><span class="o">&gt;</span><span class="p">(</span><span class="nx">element</span>: <span class="kt">T</span><span class="p">,</span> <span class="nx">from</span><span class="p">,</span> <span class="nx">to</span><span class="p">)</span> <span class="p">{</span>
    <span class="c1">// ...</span>
  <span class="p">}</span>
<span class="p">}</span>
</code></pre></div><p data-pid="WCu16LsU">然后对这个 <code>T</code> 做 <code>keyof</code> 操作，用它的 key 来约束类型：</p><div class="highlight"><pre><code class="language-ts"><span></span><span class="c1">// 这个 Partial 能帮助我们取出原始 T 类型结构的部分 key-value 子集</span>
<span class="nx">type</span> <span class="nx">Partial</span><span class="o">&lt;</span><span class="nx">T</span><span class="o">&gt;</span> <span class="o">=</span> <span class="p">{</span> <span class="p">[</span><span class="nx">P</span> <span class="k">in</span> <span class="nx">keyof</span> <span class="nx">T</span><span class="p">]</span><span class="o">?:</span> <span class="nx">T</span><span class="p">[</span><span class="nx">P</span><span class="p">]</span> <span class="o">|</span> <span class="kc">undefined</span><span class="p">;</span> <span class="p">}</span>

<span class="kr">class</span> <span class="nx">History</span> <span class="p">{</span>
  <span class="c1">// U 的结构被限定成了 T 中所存在的 key-value</span>
  <span class="nx">commit</span><span class="o">&lt;</span>
    <span class="nx">T</span> <span class="kr">extends</span> <span class="nx">Element</span><span class="p">,</span>
    <span class="nx">U</span> <span class="kr">extends</span> <span class="nx">Partial</span><span class="o">&lt;</span><span class="p">{</span> <span class="p">[</span><span class="nx">K</span> <span class="k">in</span> <span class="nx">keyof</span> <span class="nx">T</span><span class="p">]</span><span class="o">:</span> <span class="nx">T</span><span class="p">[</span><span class="nx">K</span><span class="p">]</span> <span class="p">}</span><span class="o">&gt;</span>
  <span class="o">&gt;</span><span class="p">(</span><span class="nx">element</span>: <span class="kt">T</span><span class="p">,</span> <span class="nx">from</span>: <span class="kt">U</span><span class="p">,</span> <span class="nx">to</span>: <span class="kt">U</span><span class="p">)</span> <span class="p">{</span>
    <span class="c1">// ...</span>
  <span class="p">}</span>
<span class="p">}</span>

<span class="c1">// 这样我们仍然可以这样调用</span>
<span class="nx">history</span><span class="p">.</span><span class="nx">commit</span><span class="p">(</span><span class="nx">element</span><span class="p">,</span> <span class="p">{</span> <span class="nx">left</span>: <span class="kt">0</span> <span class="p">},</span> <span class="p">{</span> <span class="nx">left</span>: <span class="kt">10</span> <span class="p">})</span>

<span class="c1">// 这样的字段 bug 就可以在编译期被发现</span>
<span class="nx">history</span><span class="p">.</span><span class="nx">commit</span><span class="p">(</span><span class="nx">element</span><span class="p">,</span> <span class="p">{</span> <span class="nx">xxx</span>: <span class="kt">0</span> <span class="p">},</span> <span class="p">{</span> <span class="nx">yyy</span>: <span class="kt">1</span> <span class="p">})</span>
</code></pre></div><p data-pid="VHn6l27f">这里先把 <code>T</code> 的结构用 <code>{ [K in keyof T]: T[K] }</code> 拿了出来，然后用 <code>Partial&lt;T&gt;</code> 来帮助我们获得这个结构的部分子集字段。例如 <code>{ a: number, b: number }</code> 的 Partial 子集就可以是 <code>{ a: number }</code>。TypeScript 还内置了很多这样的辅助类型，参见 <a href="http://link.zhihu.com/?target=https%3A//www.typescriptlang.org/docs/handbook/utility-types.html" class=" wrap external" target="_blank" rel="nofollow noreferrer">Utility Types</a>。</p><p data-pid="yKNxQfPm">然而上面的操作还不够，因为它无法解决下面这个问题：</p><div class="highlight"><pre><code class="language-ts"><span></span><span class="c1">// 虽然 `from` 和 `to` 都有效，但它们二者的字段却对不上</span>
<span class="nx">history</span><span class="p">.</span><span class="nx">commit</span><span class="p">(</span><span class="nx">element</span><span class="p">,</span> <span class="p">{</span> <span class="nx">left</span>: <span class="kt">0</span> <span class="p">},</span> <span class="p">{</span> <span class="nx">top</span>: <span class="kt">10</span> <span class="p">})</span>
</code></pre></div><p data-pid="gqqgKRZ6">某种程度上，这种 bug 才是最可能出现的。我们能进一步通过类型操作来规避它吗？只要再引入一个类型变量，依葫芦画瓢地再做一次 <code>keyof</code> 操作就可以了：</p><div class="highlight"><pre><code class="language-ts"><span></span><span class="kr">class</span> <span class="nx">History</span> <span class="p">{</span>
  <span class="nx">commit</span><span class="o">&lt;</span>
    <span class="nx">T</span> <span class="kr">extends</span> <span class="nx">Element</span><span class="p">,</span>
    <span class="c1">// 第二个参数的结构来自 T，而第三个参数的结构又来自第二个参数</span>
    <span class="nx">U</span> <span class="kr">extends</span> <span class="nx">Partial</span><span class="o">&lt;</span><span class="p">{</span> <span class="p">[</span><span class="nx">K</span> <span class="k">in</span> <span class="nx">keyof</span> <span class="nx">T</span><span class="p">]</span><span class="o">:</span> <span class="nx">T</span><span class="p">[</span><span class="nx">K</span><span class="p">]</span> <span class="p">}</span><span class="o">&gt;</span><span class="p">,</span>
    <span class="nx">V</span> <span class="kr">extends</span> <span class="p">{</span> <span class="p">[</span><span class="nx">K</span> <span class="k">in</span> <span class="nx">keyof</span> <span class="nx">U</span><span class="p">]</span><span class="o">:</span> <span class="nx">U</span><span class="p">[</span><span class="nx">K</span><span class="p">]</span> <span class="p">}</span>
  <span class="o">&gt;</span><span class="p">(</span><span class="nx">element</span>: <span class="kt">T</span><span class="p">,</span> <span class="nx">from</span>: <span class="kt">U</span><span class="p">,</span> <span class="nx">to</span>: <span class="kt">V</span><span class="p">)</span> <span class="p">{</span>
    <span class="c1">// ...</span>
  <span class="p">}</span>
<span class="p">}</span>

<span class="c1">// 现在 `from` 和 `to` 的字段就必须完全一致了</span>
<span class="nx">history</span><span class="p">.</span><span class="nx">commit</span><span class="p">(</span><span class="nx">element</span><span class="p">,</span> <span class="p">{</span> <span class="nx">left</span>: <span class="kt">0</span> <span class="p">},</span> <span class="p">{</span> <span class="nx">left</span>: <span class="kt">10</span> <span class="p">})</span>

<span class="c1">// 上面问题就可以在编译期被校验掉</span>
<span class="nx">history</span><span class="p">.</span><span class="nx">commit</span><span class="p">(</span><span class="nx">element</span><span class="p">,</span> <span class="p">{</span> <span class="nx">left</span>: <span class="kt">0</span> <span class="p">},</span> <span class="p">{</span> <span class="nx">top</span>: <span class="kt">10</span> <span class="p">})</span>
</code></pre></div><p data-pid="V6l_5uF4">好了，这个难度系数仅为 0.5 的体操顺利完成了。通过这种方式，我们通过寥寥几行类型空间的代码，就能借助 TypeScript 类型检查器的威力，将原本需要放在运行时的校验逻辑直接优化到在编译期完成，从而在性能和开发体验上都获得明显的提升，直接赢两次！</p><p data-pid="cqzEmSb3">当然，相信可能很多同学会指出，这种手法还无法对运行时动态的数据做校验。但其实只要通过运行时库，<b>TypeScript 也可以用来写出语义化的运行时校验</b>。笔者贡献过的 <a href="http://link.zhihu.com/?target=https%3A//github.com/ianstormtaylor/superstruct" class=" wrap external" target="_blank" rel="nofollow noreferrer">Superstruct</a> 和 <a class="member_mention" href="http://www.zhihu.com/people/6751e943236c0381facaf51cf6fa1f43" data-hash="6751e943236c0381facaf51cf6fa1f43" data-hovercard="p$b$6751e943236c0381facaf51cf6fa1f43">@工业聚</a> 的 <a href="http://link.zhihu.com/?target=https%3A//github.com/farrow-js/farrow" class=" wrap external" target="_blank" rel="nofollow noreferrer">Farrow</a> 都做到了这一点（Farrow 已经做成了全家桶式的 Web 框架，但个人认为其中最创新的地方是其中可单独使用的 Schema 部分）。比如这样：</p><div class="highlight"><pre><code class="language-ts"><span></span><span class="kr">import</span> <span class="p">{</span> <span class="nx">assert</span><span class="p">,</span> <span class="nx">object</span><span class="p">,</span> <span class="kt">number</span><span class="p">,</span> <span class="kt">string</span><span class="p">,</span> <span class="nx">array</span> <span class="p">}</span> <span class="nx">from</span> <span class="s1">'superstruct'</span>

<span class="c1">// 定义出校验结构，相当于运行时的 interface</span>
<span class="kr">const</span> <span class="nx">Article</span> <span class="o">=</span> <span class="nx">object</span><span class="p">({</span>
  <span class="nx">id</span>: <span class="kt">number</span><span class="p">(),</span>
  <span class="nx">title</span>: <span class="kt">string</span><span class="p">(),</span>
  <span class="nx">tags</span>: <span class="kt">array</span><span class="p">(</span><span class="kt">string</span><span class="p">()),</span>
  <span class="nx">author</span>: <span class="kt">object</span><span class="p">({</span>
    <span class="nx">id</span>: <span class="kt">number</span><span class="p">(),</span>
  <span class="p">}),</span>
<span class="p">})</span>

<span class="kr">const</span> <span class="nx">data</span> <span class="o">=</span> <span class="p">{</span>
  <span class="nx">id</span>: <span class="kt">34</span><span class="p">,</span>
  <span class="nx">title</span><span class="o">:</span> <span class="s1">'Hello World'</span><span class="p">,</span>
  <span class="nx">tags</span><span class="o">:</span> <span class="p">[</span><span class="s1">'news'</span><span class="p">,</span> <span class="s1">'features'</span><span class="p">],</span>
  <span class="nx">author</span><span class="o">:</span> <span class="p">{</span>
    <span class="nx">id</span>: <span class="kt">1</span><span class="p">,</span>
  <span class="p">},</span>
<span class="p">}</span>

<span class="c1">// 这个 assert 发生在运行时而非编译时</span>
<span class="nx">assert</span><span class="p">(</span><span class="nx">data</span><span class="p">,</span> <span class="nx">Article</span><span class="p">)</span>
</code></pre></div><p data-pid="oMniNOj8">这样一来，我们就以 schema 为抓手，将类型空间的能力下沉到了值空间，拉通了端到端类型校验的全链路，形成了强类型闭环，赋能了运行时业务，打出了一套组合拳。试问能够如此这般成就用户的 TypeScript 赛道，足够击穿你的心智吗？</p><h2>总结</h2><p data-pid="g0f2eSAo">本文对 TypeScript 中隐藏着的类型空间做了介绍，并介绍了在其中进行操作的一些基本手法（声明类型变量、从类型生成新类型等等）。对于未来的 low code 系统，如果我们对类型检查器具备更多的掌控，那么就有机会获得一些奇妙的的进步（举个例子，你觉得表单算不算一种依赖类型呢）。这方面仍然有非常大的想象空间。</p><p data-pid="4-p2rxN0">从 JavaScript 到 TypeScript 的感受，很像笔者自己当年从（谭浩强风格的）C 转向 JavaScript 时的感受——<b>原来编程语言的功能可以这么强大</b>。在这一点上有一张讲「Python 真奇妙啊」的 XKCD 图很契合，大概就是这种感觉吧：</p><figure data-size="normal"><img src="https://picx.zhimg.com/v2-4e6c238477813abd5335d7bf51b54c15_720w.jpg?source=d16d100b" data-rawwidth="518" data-rawheight="588" data-size="normal" data-caption="" class="origin_image zh-lightbox-thumb" width="518" data-original="https://picx.zhimg.com/v2-4e6c238477813abd5335d7bf51b54c15_720w.jpg?source=d16d100b"></figure><p data-pid="CMDU-f8C">感谢 <a class="member_mention" href="http://www.zhihu.com/people/9c1485aaca42cc447431148a1d0e157b" data-hash="9c1485aaca42cc447431148a1d0e157b" data-hovercard="p$b$9c1485aaca42cc447431148a1d0e157b">@三七二十</a> 和 <a class="member_mention" href="http://www.zhihu.com/people/90a0a628550c173221d92122e73bfe9f" data-hash="90a0a628550c173221d92122e73bfe9f" data-hovercard="p$b$90a0a628550c173221d92122e73bfe9f">@某兔</a> 提供的体操技能指导，另外对 TypeScript 编译器的贡献者还有 <a class="member_mention" href="http://www.zhihu.com/people/24027d17bd5b48cfd5d6ef2346278a47" data-hash="24027d17bd5b48cfd5d6ef2346278a47" data-hovercard="p$b$24027d17bd5b48cfd5d6ef2346278a47">@王文璐</a> 活跃在知乎，他们都对 TS 理念的传播有很大的帮助。另外顺便推荐一下知乎的「<a href="https://www.zhihu.com/column/c_206498766" class="internal">来玩 TypeScript 啊，机都给你开好了</a>」专栏，虽然我之前一直没看懂。</p><p data-pid="yHupAVJV">由于国内传统的计算机教育尚普遍较为缺乏类型层面编程的知识，TypeScript 的高级功能仍然被认知和发掘得不够充分。非常推荐感兴趣的同学继续学习了解 TypeScript 的类型系统及其背后的原理，它或许可以为大家打开一扇通向新世界的大门。</p><h2>参考资料</h2><ul><li data-pid="i8shrGEc"><a href="http://link.zhihu.com/?target=https%3A//stackoverflow.com/questions/24481113/what-are-some-examples-of-type-level-programming" class=" wrap external" target="_blank" rel="nofollow noreferrer">What are some examples of type-level programming?</a></li><li data-pid="nhD9-Exg"><a href="http://link.zhihu.com/?target=https%3A//stackoverflow.com/questions/51131898/what-is-the-difference-between-type-and-class-in-typescript/51132333%2351132333" class=" wrap external" target="_blank" rel="nofollow noreferrer">What is the difference between type and class in Typescript?</a></li><li data-pid="s0M2ZIm_"><a href="http://link.zhihu.com/?target=https%3A//www.typescriptlang.org/docs/handbook/2/types-from-types.html" class=" wrap external" target="_blank" rel="nofollow noreferrer">TypeScript: Documentation - Creating Types from Types</a></li><li data-pid="HPGdnmvi"><a href="http://link.zhihu.com/?target=https%3A//www.typescriptlang.org/docs/handbook/2/generics.html" class=" wrap external" target="_blank" rel="nofollow noreferrer">TypeScript: Documentation - Generics</a></li><li data-pid="9Ll3uD-U"><a href="http://link.zhihu.com/?target=https%3A//www.typescriptlang.org/docs/handbook/2/keyof-types.html" class=" wrap external" target="_blank" rel="nofollow noreferrer">TypeScript: Documentation - Keyof Type Operator</a></li></ul><p data-pid="TUGX5Q1M">（本文题图来自 <a href="http://link.zhihu.com/?target=https%3A//unsplash.com/" class=" wrap external" target="_blank" rel="nofollow noreferrer">Unsplash</a>）</p>