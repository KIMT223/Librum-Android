(function(){
  "use strict";

  /* ================= 存储层：Android 原生桥接，浏览器回退 localStorage ================= */

  var Store = {
    hasNative: function(){
      return !!(
        window.AndroidStorage &&
        typeof window.AndroidStorage.read === 'function' &&
        typeof window.AndroidStorage.write === 'function' &&
        typeof window.AndroidStorage.remove === 'function'
      );
    },

    read: function(path){
      if (this.hasNative()){
        try {
          return Promise.resolve(window.AndroidStorage.read(path));
        } catch(e) {}
      }

      return Promise.resolve(
        localStorage.getItem('mdwiki:' + path)
      );
    },

    write: function(path, content){
      if (this.hasNative()){
        try {
          var ok = window.AndroidStorage.write(path, content);

          /*
           * Kotlin 当前版本 write() 没有返回值，
           * 所以这里只要没有抛异常，就认为写入成功。
           */
          return Promise.resolve(ok);
        } catch(e) {}
      }

      localStorage.setItem('mdwiki:' + path, content);
      return Promise.resolve();
    },

    remove: function(path){
      if (this.hasNative()){
        try {
          window.AndroidStorage.remove(path);
          return Promise.resolve();
        } catch(e) {}
      }

      localStorage.removeItem('mdwiki:' + path);
      return Promise.resolve();
    }
  };


  var SETTINGS_PATH = 'wiki/settings.json';
  var INDEX_PATH = 'wiki/index.json';

  function pagePath(slug){
    return 'wiki/pages/' + slug + '.md';
  }


  var DEFAULT_WIKI_NAME = 'Librum';
  var DEFAULT_HOME_TITLE = '主页';


  /* ================= 应用状态 ================= */

  var state = {
    wikiName: DEFAULT_WIKI_NAME,
    pages: [],

    view: 'all',
    currentSlug: null,
    editingIsNew: false,

    searchQuery: '',
    searchResults: null,
    searching: false,

    _newTitle: '',
    _editBody: ''
  };


  /* ================= 工具 ================= */

  function esc(s){
    return String(s)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;');
  }


  function fmtTime(ts){
    var d = new Date(ts);

    function p(n){
      return n < 10 ? '0' + n : n;
    }

    return d.getFullYear() +
      '-' + p(d.getMonth() + 1) +
      '-' + p(d.getDate()) +
      ' ' + p(d.getHours()) +
      ':' + p(d.getMinutes());
  }


  function slugify(){
    return 'p' +
      Date.now().toString(36) +
      Math.random().toString(36).slice(2,7);
  }


  function toast(msg){
    var el = document.getElementById('toast');

    if (!el) return;

    el.textContent = msg;
    el.classList.add('show');

    clearTimeout(toast._t);

    toast._t = setTimeout(function(){
      el.classList.remove('show');
    }, 1800);
  }


  /* ================= Markdown 渲染 ================= */

  /*
   * Wiki 链接：
   *
   * [[页面标题]]
   * [[页面标题|显示文字]]
   *
   * 处理原则：
   *
   * 1. 先保护 fenced code block
   * 2. 再保护 inline code
   * 3. 再处理 Wiki 链接
   * 4. 如果 marked.js 存在：
   *      - 恢复代码块为真正的 Markdown
   *      - 恢复行内代码为真正的 Markdown
   *      - 交给 marked 完整解析
   *      - 最后恢复 Wiki TOKEN
   *
   * 这样代码中的 [[页面]] 不会被当成 Wiki 链接。
   */

  function renderMarkdown(md){

    if (!md || !String(md).trim()){
      return '<p style="color:var(--text-faint)">（空白页面）</p>';
    }


    var wikiLinks = [];
    var codeBlocks = [];
    var inlineCodes = [];

    var source = String(md);


    /* =========================================================
     * 保护 fenced code block
     * ========================================================= */

    source = source.replace(
      /```([^\n]*)\n([\s\S]*?)(?:\n)?```/g,
      function(_, lang, code){

        var index = codeBlocks.length;

        codeBlocks.push({
          lang: (lang || '').trim(),
          code: code
        });

        return 'MDWIKICODEBLOCK' + index + 'TOKEN';
      }
    );


    /* =========================================================
     * 保护 inline code
     * ========================================================= */

    source = source.replace(
      /`([^`\n]+)`/g,
      function(_, code){

        var index = inlineCodes.length;

        inlineCodes.push(code);

        return 'MDWIKIINLINECODE' + index + 'TOKEN';
      }
    );


    /* =========================================================
     * 处理 Wiki 链接
     * ========================================================= */

    source = source.replace(
      /\[\[([^\]|\n]+)(?:\|([^\]\n]+))?\]\]/g,
      function(_, title, label){

        var index = wikiLinks.length;

        wikiLinks.push({
          title: title.trim(),
          label: (label || title).trim()
        });

        return 'MDWIKILINK' + index + 'TOKEN';
      }
    );


    /*
     * 保存给后备 Markdown 渲染器。
     *
     * 这里代码块仍然是 TOKEN，
     * 因为后备渲染器需要根据 TOKEN 判断代码块。
     */
    var fallbackSource = source;


    /* =========================================================
     * Wiki HTML
     * ========================================================= */

    function wikiHtml(link){

      return '<a href="#" class="wiki-link" data-wiki-title="' +
        esc(link.title).replace(/"/g, '&quot;') +
        '">' +
        esc(link.label) +
        '</a>';
    }


    /* =========================================================
     * Code HTML
     * ========================================================= */

    function codeBlockHtml(item){

      /*
       * 语言标识最终进入 class 属性。
       * 只保留常见的语言标识字符。
       */
      var lang = String(item.lang || '')
        .replace(/[^a-zA-Z0-9_+-]/g, '');

      var cls = lang
        ? ' class="language-' + lang + '"'
        : '';

      return '<pre><code' + cls + '>' +
        esc(item.code) +
        '</code></pre>';
    }


    function inlineCodeHtml(code){

      return '<code>' +
        esc(code) +
        '</code>';

    }


    /* =========================================================
     * 恢复 Wiki TOKEN
     *
     * 注意：
     * 这里不恢复代码 TOKEN。
     *
     * 正常情况下代码已经恢复成 Markdown，
     * 由 marked 自己生成 <code> / <pre><code>。
     * ========================================================= */

    function restoreWikiTokens(html){

      wikiLinks.forEach(function(link, index){

        html = html.split(
          'MDWIKILINK' + index + 'TOKEN'
        ).join(
          wikiHtml(link)
        );

      });

      return html;
    }


    /* =========================================================
     * marked.js
     * ========================================================= */

    if (
      window.marked &&
      typeof window.marked.parse === 'function'
    ){

      try {

        /*
         * 复制一份给 Marked。
         */
        var markedSource = source;


        /* ---------- 恢复 fenced code block ---------- */

        codeBlocks.forEach(
          function(item, index){

            markedSource = markedSource.split(
              'MDWIKICODEBLOCK' +
              index +
              'TOKEN'
            ).join(

              '```' +
              (item.lang || '') +
              '\n' +
              item.code +
              '\n```'

            );

          }
        );


        /* ---------- 恢复 inline code ---------- */

        inlineCodes.forEach(
          function(code, index){

            /*
             * 如果代码本身包含反引号，
             * 使用双反引号作为 Markdown 分隔符。
             */

            var delimiter = '`';

            if (code.indexOf('`') !== -1){
              delimiter = '``';
            }

            markedSource = markedSource.split(
              'MDWIKIINLINECODE' +
              index +
              'TOKEN'
            ).join(

              delimiter +
              code +
              delimiter

            );

          }
        );


        /* ---------- 配置 marked ---------- */

        if (
          typeof window.marked.setOptions === 'function'
        ){

          window.marked.setOptions({
            gfm: true,
            breaks: true
          });

        }


        /* ---------- 正式解析 Markdown ---------- */

        var html =
          window.marked.parse(
            markedSource
          );


        /*
         * Marked 现在负责处理：
         *
         * # 标题
         * ## 二级标题
         * **加粗**
         * *斜体*
         * `代码`
         * ```代码块```
         * - 列表
         * 1. 有序列表
         * > 引用
         * [链接](...)
         * 表格
         * ~~删除线~~
         *
         * 最后只处理 Librum 自己的 Wiki TOKEN。
         */

        return restoreWikiTokens(html);


      } catch(e){

        console.error(
          'marked 渲染失败：',
          e
        );

      }

    }


    /* =========================================================
     * 内置 Markdown 后备渲染器
     *
     * 当 marked.js 没有加载成功时使用。
     * ========================================================= */

    var lines =
      fallbackSource.split(/\r?\n/);

    var out = [];

    var inList = false;
    var inQuote = false;


    function inline(text){

      text = esc(text);


      /* ---------- 加粗 ---------- */

      text = text.replace(
        /\*\*([^*]+)\*\*/g,
        '<strong>$1</strong>'
      );

      text = text.replace(
        /__([^_]+)__/g,
        '<strong>$1</strong>'
      );


      /* ---------- 斜体 ---------- */

      text = text.replace(
        /\*([^*]+)\*/g,
        '<em>$1</em>'
      );

      text = text.replace(
        /_([^_]+)_/g,
        '<em>$1</em>'
      );


      /* ---------- 普通 URL Markdown 链接 ---------- */

      text = text.replace(
        /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
      );


      /* ---------- 恢复 Wiki 链接 ---------- */

      wikiLinks.forEach(
        function(link, index){

          text = text.split(
            'MDWIKILINK' +
            index +
            'TOKEN'
          ).join(
            wikiHtml(link)
          );

        }
      );


      /* ---------- 恢复行内代码 ---------- */

      inlineCodes.forEach(
        function(code, index){

          text = text.split(
            'MDWIKIINLINECODE' +
            index +
            'TOKEN'
          ).join(
            inlineCodeHtml(code)
          );

        }
      );


      return text;

    }


    function closeBlocks(){

      if (inList){

        out.push('</ul>');

        inList = false;

      }


      if (inQuote){

        out.push('</blockquote>');

        inQuote = false;

      }

    }


    lines.forEach(
      function(line){

        var m;


        /* ---------- fenced code block ---------- */

        var blockMatch =
          /^MDWIKICODEBLOCK(\d+)TOKEN$/.exec(
            line.trim()
          );


        if (blockMatch){

          closeBlocks();


          var codeIndex =
            Number(blockMatch[1]);


          if (codeBlocks[codeIndex]){

            out.push(
              codeBlockHtml(
                codeBlocks[codeIndex]
              )
            );

          }


          return;

        }


        /* ---------- 空行 ---------- */

        if (!line.trim()){

          closeBlocks();

          return;

        }


        /* ---------- 标题 ---------- */

        if (
          (m = /^(#{1,6})\s+(.+)$/.exec(line))
        ){

          closeBlocks();


          var level =
            m[1].length;


          out.push(
            '<h' +
            level +
            '>' +
            inline(m[2]) +
            '</h' +
            level +
            '>'
          );


          return;

        }


        /* ---------- 无序列表 ---------- */

        if (
          (m = /^\s*[-*]\s+(.+)$/.exec(line))
        ){

          if (inQuote){

            out.push('</blockquote>');

            inQuote = false;

          }


          if (!inList){

            out.push('<ul>');

            inList = true;

          }


          out.push(
            '<li>' +
            inline(m[1]) +
            '</li>'
          );


          return;

        }


        /* ---------- 引用 ---------- */

        if (
          (m = /^>\s?(.*)$/.exec(line))
        ){

          if (inList){

            out.push('</ul>');

            inList = false;

          }


          if (!inQuote){

            out.push('<blockquote>');

            inQuote = true;

          }


          out.push(
            '<p>' +
            inline(m[1]) +
            '</p>'
          );


          return;

        }


        /* ---------- 普通段落 ---------- */

        closeBlocks();


        out.push(
          '<p>' +
          inline(line) +
          '</p>'
        );

      }
    );


    closeBlocks();


    return out.join('');

  }


  /* ================= 数据操作 ================= */

  function loadAll(){

    return Promise.all([
      Store.read(SETTINGS_PATH),
      Store.read(INDEX_PATH)
    ]).then(function(res){

      try {

        var s = JSON.parse(res[0]);

        if (s && s.wikiName){
          state.wikiName = s.wikiName;
        }

      } catch(e){}


      try {

        var idx = JSON.parse(res[1]);

        if (Array.isArray(idx)){
          state.pages = idx;
        }

      } catch(e){}

    });

  }


  function saveSettings(){

    return Store.write(
      SETTINGS_PATH,
      JSON.stringify({
        wikiName: state.wikiName
      })
    );

  }


  function saveIndex(){

    return Store.write(
      INDEX_PATH,
      JSON.stringify(state.pages)
    );

  }


  function createPage(title, body){

    var slug = slugify();

    var now = Date.now();

    var t =
      (title || '').trim() ||
      '未命名页面';


    state.pages.unshift({
      slug: slug,
      title: t,
      createdAt: now,
      updatedAt: now
    });


    return Promise.all([
      Store.write(
        pagePath(slug),
        body || ''
      ),

      saveIndex()

    ]).then(function(){

      return slug;

    });

  }


  function updatePage(slug, title, body){

    var p = state.pages.find(function(x){
      return x.slug === slug;
    });


    if (p){

      p.title =
        (title || '').trim() ||
        '未命名页面';

      p.updatedAt = Date.now();

    }


    return Promise.all([
      Store.write(
        pagePath(slug),
        body || ''
      ),

      saveIndex()

    ]);

  }


  function deletePage(slug){

    state.pages = state.pages.filter(
      function(x){
        return x.slug !== slug;
      }
    );


    return Promise.all([
      Store.remove(pagePath(slug)),
      saveIndex()
    ]);

  }


  function pageMeta(slug){

    return state.pages.find(function(x){
      return x.slug === slug;
    });

  }


  function pageByTitle(title){

    var t =
      String(title || '')
        .trim()
        .toLowerCase();


    return state.pages.find(function(x){

      return String(x.title || '')
        .trim()
        .toLowerCase() === t;

    });

  }


  function sortedPages(){

    return state.pages.slice().sort(
      function(a,b){
        return b.updatedAt - a.updatedAt;
      }
    );

  }


  /* ================= 视图切换 ================= */

  function setView(v, opts){

    state.view = v;

    opts = opts || {};

    state.currentSlug =
      opts.slug || null;

    state.editingIsNew =
      !!opts.isNew;

    closeDrawer();

    render();

  }


  function openDrawer(){

    document
      .getElementById('drawer')
      .classList.add('open');

    document
      .getElementById('drawerOverlay')
      .classList.add('open');

  }


  function closeDrawer(){

    document
      .getElementById('drawer')
      .classList.remove('open');

    document
      .getElementById('drawerOverlay')
      .classList.remove('open');

  }


  /* ================= 渲染 ================= */

  var contentEl =
    document.getElementById('content');

  var fabEl =
    document.getElementById('fab');


  function render(){

    document.getElementById(
      'wikiTitle'
    ).textContent = state.wikiName;


    document.title =
      state.wikiName;


    var navItems =
      document.querySelectorAll('.nav-item');


    for (
      var i = 0;
      i < navItems.length;
      i++
    ){

      navItems[i].classList.toggle(
        'active',

        navItems[i].getAttribute(
          'data-view'
        ) === state.view &&

        (
          state.view === 'all' ||
          state.view === 'search' ||
          state.view === 'settings'
        )
      );

    }


    fabEl.style.display =
      (
        state.view === 'all' ||
        state.view === 'search'
      )
      ? 'flex'
      : 'none';


    if (state.view === 'all'){
      return renderAll();
    }

    if (state.view === 'search'){
      return renderSearch();
    }

    if (state.view === 'settings'){
      return renderSettings();
    }

    if (state.view === 'page'){
      return renderPage();
    }

    if (state.view === 'edit'){
      return renderEdit();
    }

  }


  /* ================= 全部页面 ================= */

  function renderAll(){

    var list = sortedPages();

    var html =
      '<div class="pad">';


    if (!list.length){

      html += emptyState(

        '<circle cx="12" cy="12" r="9"/>' +
        '<path d="M8 12h8M12 8v8"/>',

        '还没有页面',

        '点击右下角的加号，创建第一篇 wiki 页面'

      );

    } else {

      html +=
        '<div class="section-label">' +
        '共 ' + list.length + ' 篇页面' +
        '</div>' +

        '<div class="page-list">';


      list.forEach(function(p){

        html +=
          '<div class="page-row" data-open="' +
          esc(p.slug) +
          '">' +

          '<div class="ti">' +

          '<div class="title">' +
          esc(p.title) +
          '</div>' +

          '<div class="meta">' +
          '更新于 ' +
          fmtTime(p.updatedAt) +
          '</div>' +

          '</div>' +

          '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M9 6l6 6-6 6"/>' +
          '</svg>' +

          '</div>';

      });


      html += '</div>';

    }


    html += '</div>';

    contentEl.innerHTML = html;


    qa('[data-open]').forEach(
      function(el){

        el.addEventListener(
          'click',
          function(){

            setView(
              'page',
              {
                slug:
                  el.getAttribute(
                    'data-open'
                  )
              }
            );

          }
        );

      }
    );

  }


  /* ================= 搜索 ================= */

  function renderSearch(){

    var html =
      '<div class="pad">' +

      '<div class="search-box">' +

      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
      '<circle cx="11" cy="11" r="7"/>' +
      '<path d="M21 21l-4.3-4.3"/>' +
      '</svg>' +

      '<input id="searchInput" type="text" placeholder="搜索标题或正文…" value="' +
      esc(state.searchQuery) +
      '" autocomplete="off">' +

      '</div>' +

      '<div id="searchResults"></div>' +

      '</div>';


    contentEl.innerHTML = html;


    var input =
      document.getElementById(
        'searchInput'
      );


    input.focus();


    input.addEventListener(
      'input',
      function(){

        state.searchQuery =
          input.value;

        runSearch();

      }
    );


    renderSearchResults();


    if (state.searchQuery){
      runSearch();
    }

  }


  var searchDebounce;


  function runSearch(){

    clearTimeout(searchDebounce);

    var q =
      state.searchQuery.trim();


    if (!q){

      state.searchResults = null;

      renderSearchResults();

      return;
    }


    searchDebounce =
      setTimeout(
        function(){
          doSearch(q);
        },
        160
      );

  }


  function doSearch(q){

    var qLower =
      q.toLowerCase();


    var titleMatches =
      state.pages.filter(
        function(p){

          return p.title
            .toLowerCase()
            .indexOf(qLower) !== -1;

        }
      );


    var titleSlugs = {};

    titleMatches.forEach(
      function(p){
        titleSlugs[p.slug] = true;
      }
    );


    var others =
      state.pages.filter(
        function(p){
          return !titleSlugs[p.slug];
        }
      );


    Promise.all(
      others.map(
        function(p){

          return Store.read(
            pagePath(p.slug)
          ).then(
            function(body){

              return {
                p: p,
                body: body || ''
              };

            }
          );

        }
      )
    ).then(
      function(results){

        var contentMatches = [];


        results.forEach(
          function(r){

            var idx =
              r.body
                .toLowerCase()
                .indexOf(qLower);


            if (idx !== -1){

              var start =
                Math.max(
                  0,
                  idx - 24
                );


              contentMatches.push({
                p: r.p,

                snippet:
                  r.body.slice(
                    start,
                    idx + q.length + 40
                  )
              });

            }

          }
        );


        if (
          state.searchQuery.trim() !== q
        ){
          return;
        }


        state.searchResults =
          titleMatches
            .map(
              function(p){
                return {
                  p: p,
                  snippet: null
                };
              }
            )
            .concat(contentMatches);


        renderSearchResults();

      }
    );

  }


  function highlight(text){

    var q =
      state.searchQuery.trim();


    if (!q){
      return esc(text);
    }


    var re =
      new RegExp(
        '(' +
        q.replace(
          /[.*+?^${}()|[\]\\]/g,
          '\\$&'
        ) +
        ')',
        'ig'
      );


    return esc(text).replace(
      re,
      function(m){
        return '<mark>' +
          m +
          '</mark>';
      }
    );

  }


  function renderSearchResults(){

    var el =
      document.getElementById(
        'searchResults'
      );


    if (!el){
      return;
    }


    var q =
      state.searchQuery.trim();


    if (!q){

      el.innerHTML = '';

      return;
    }


    if (state.searchResults === null){

      el.innerHTML =
        '<div class="section-label">搜索中…</div>';

      return;
    }


    if (!state.searchResults.length){

      el.innerHTML =
        emptyState(

          '<circle cx="11" cy="11" r="7"/>' +
          '<path d="M21 21l-4.3-4.3"/>',

          '没有找到相关页面',

          '换个关键词试试，或检查一下拼写'

        );

      return;
    }


    var html =
      '<div class="section-label">' +
      '找到 ' +
      state.searchResults.length +
      ' 条结果' +
      '</div>' +

      '<div class="page-list">';


    state.searchResults.forEach(
      function(r){

        html +=
          '<div class="page-row" data-open="' +
          esc(r.p.slug) +
          '">' +

          '<div class="ti">' +

          '<div class="title">' +
          highlight(r.p.title) +
          '</div>' +

          (
            r.snippet

            ? '<div class="snippet">…' +
              highlight(r.snippet) +
              '…</div>'

            : '<div class="meta">更新于 ' +
              fmtTime(r.p.updatedAt) +
              '</div>'
          ) +

          '</div>' +

          '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M9 6l6 6-6 6"/>' +
          '</svg>' +

          '</div>';

      }
    );


    html += '</div>';

    el.innerHTML = html;


    qa('[data-open]', el).forEach(
      function(node){

        node.addEventListener(
          'click',
          function(){

            setView(
              'page',
              {
                slug:
                  node.getAttribute(
                    'data-open'
                  )
              }
            );

          }
        );

      }
    );

  }


  /* ================= 设置 ================= */

  function renderSettings(){

    var html =
      '<div class="pad">' +

      '<div class="stat-card">' +

      '<div>' +

      '<div class="n">' +
      state.pages.length +
      '</div>' +

      '<div class="l">篇页面</div>' +

      '</div>' +

      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:26px;height:26px;color:var(--text-faint)">' +
      '<path d="M4 6h16M4 12h16M4 18h10"/>' +
      '</svg>' +

      '</div>' +


      '<div class="field">' +
      '<label>Wiki 名称</label>' +

      '<input type="text" id="wikiNameInput" value="' +
      esc(state.wikiName) +
      '">' +

      '</div>' +


      '<div class="row-gap" style="margin-bottom:8px;">' +

      '<button class="btn primary" id="saveNameBtn">' +
      '保存名称' +
      '</button>' +

      '</div>' +


      '<div class="divider"></div>' +

      '<div class="danger-zone-label">危险操作</div>' +

      '<div class="row-gap">' +

      '<button class="btn danger" id="wipeBtn">' +
      '清空全部页面' +
      '</button>' +

      '</div>' +

      '</div>';


    contentEl.innerHTML = html;


    document
      .getElementById('saveNameBtn')
      .addEventListener(
        'click',
        function(){

          var v =
            document
              .getElementById(
                'wikiNameInput'
              )
              .value
              .trim();


          state.wikiName =
            v || DEFAULT_WIKI_NAME;


          saveSettings().then(
            function(){

              toast('名称已保存');

              render();

            }
          );

        }
      );


    document
      .getElementById('wipeBtn')
      .addEventListener(
        'click',
        function(){

          openConfirm(
            '清空全部页面？',

            '将删除所有 ' +
            state.pages.length +
            ' 篇页面，此操作无法撤销。',

            function(){

              var slugs =
                state.pages.map(
                  function(p){
                    return p.slug;
                  }
                );


              state.pages = [];


              Promise.all(
                slugs
                  .map(
                    function(s){
                      return Store.remove(
                        pagePath(s)
                      );
                    }
                  )
                  .concat([
                    saveIndex()
                  ])
              ).then(
                function(){

                  toast('已清空');

                  setView('all');

                }
              );

            }
          );

        }
      );

  }


  /* ================= 页面 ================= */

  function renderPage(){

    var p =
      pageMeta(state.currentSlug);


    if (!p){

      setView('all');

      return;
    }


    contentEl.innerHTML =
      '<div class="pad">' +
      '<div class="section-label">加载中…</div>' +
      '</div>';


    Store.read(
      pagePath(p.slug)
    ).then(
      function(body){

        if (
          state.view !== 'page' ||
          state.currentSlug !== p.slug
        ){
          return;
        }


        var html =
          '<div class="pad">' +

          '<div class="page-header">' +

          '<h1>' +
          esc(p.title) +
          '</h1>' +

          '<div class="page-actions">' +


          '<button class="icon-btn" id="editPageBtn" aria-label="编辑">' +

          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M12 20h9"/>' +
          '<path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4z"/>' +
          '</svg>' +

          '</button>' +


          '<button class="icon-btn" id="deletePageBtn" aria-label="删除">' +

          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>' +
          '</svg>' +

          '</button>' +


          '</div>' +

          '</div>' +


          '<div class="page-meta">' +
          '更新于 ' +
          fmtTime(p.updatedAt) +
          '</div>' +


          '<div class="markdown-body">' +
          renderMarkdown(body || '') +
          '</div>' +


          '</div>';


        contentEl.innerHTML = html;


        /* 编辑 */

        document
          .getElementById('editPageBtn')
          .addEventListener(
            'click',
            function(){

              state._editBody =
                body || '';

              setView(
                'edit',
                {
                  slug: p.slug,
                  isNew: false
                }
              );

            }
          );


        /* 删除 */

        document
          .getElementById('deletePageBtn')
          .addEventListener(
            'click',
            function(){

              openConfirm(

                '删除该页面？',

                '「' +
                p.title +
                '」将被永久删除，此操作无法撤销。',

                function(){

                  deletePage(
                    p.slug
                  ).then(
                    function(){

                      toast('已删除');

                      setView('all');

                    }
                  );

                }

              );

            }
          );


        /* Wiki 链接 */

        qa(
          '.wiki-link',
          contentEl
        ).forEach(
          function(link){

            link.addEventListener(
              'click',
              function(e){

                e.preventDefault();


                var title =
                  link.getAttribute(
                    'data-wiki-title'
                  ) || '';


                var target =
                  pageByTitle(title);


                if (target){

                  /* 页面存在 */

                  setView(
                    'page',
                    {
                      slug: target.slug
                    }
                  );

                } else {

                  /*
                   * 页面不存在：
                   * 打开新建页面，
                   * 自动填写标题。
                   */

                  state._newTitle =
                    title;


                  setView(
                    'edit',
                    {
                      isNew: true
                    }
                  );

                }

              }
            );

          }
        );

      }
    );

  }


  /* ================= 编辑页面 ================= */

  function renderEdit(){

    var isNew =
      state.editingIsNew;


    var p =
      isNew
        ? null
        : pageMeta(state.currentSlug);


    var title =
      isNew
        ? (state._newTitle || '')
        : (p ? p.title : '');


    var body =
      isNew
        ? ''
        : (state._editBody || '');


    var html =
      '<div class="pad" style="display:flex;flex-direction:column;height:calc(100% - 90px);">' +

      '<div class="edit-wrap">' +


      '<input id="editTitle" type="text" placeholder="页面标题" value="' +
      esc(title) +
      '">' +


      '<textarea id="editBody" placeholder="用 Markdown 写点什么…\n\n# 一级标题\n**加粗** *斜体* `代码`\n- 列表项\n> 引用">' +
      esc(body) +
      '</textarea>' +


      '<div class="row-gap">' +

      '<button class="btn primary" id="saveEditBtn">' +
      '保存' +
      '</button>' +

      '<button class="btn" id="cancelEditBtn">' +
      '取消' +
      '</button>' +

      '</div>' +

      '</div>' +

      '</div>';


    contentEl.innerHTML = html;


    document
      .getElementById('editTitle')
      .focus();


    /* 保存 */

    document
      .getElementById('saveEditBtn')
      .addEventListener(
        'click',
        function(){

          var t =
            document
              .getElementById(
                'editTitle'
              )
              .value;


          var b =
            document
              .getElementById(
                'editBody'
              )
              .value;


          if (isNew){

            createPage(
              t,
              b
            ).then(
              function(slug){

                state._newTitle = '';

                toast('已创建');

                setView(
                  'page',
                  {
                    slug: slug
                  }
                );

              }
            );

          } else {

            updatePage(
              p.slug,
              t,
              b
            ).then(
              function(){

                toast('已保存');

                setView(
                  'page',
                  {
                    slug: p.slug
                  }
                );

              }
            );

          }

        }
      );


    /* 取消 */

    document
      .getElementById('cancelEditBtn')
      .addEventListener(
        'click',
        function(){

          if (isNew){

            state._newTitle = '';

            setView('all');

          } else {

            setView(
              'page',
              {
                slug: p.slug
              }
            );

          }

        }
      );

  }


  /* ================= 空状态 ================= */

  function emptyState(
    iconPath,
    title,
    sub
  ){

    return (
      '<div class="empty-state">' +

      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
      iconPath +
      '</svg>' +

      '<div class="t">' +
      esc(title) +
      '</div>' +

      '<div class="s">' +
      esc(sub) +
      '</div>' +

      '</div>'
    );

  }


  function qa(
    sel,
    root
  ){

    return Array.prototype.slice.call(
      (
        root || document
      ).querySelectorAll(sel)
    );

  }


  /* ================= 模态框 ================= */

  var modalOverlay =
    document.getElementById(
      'modalOverlay'
    );


  var modalBox =
    document.getElementById(
      'modalBox'
    );


  function closeModal(){

    modalOverlay.classList.remove(
      'open'
    );

    modalBox.innerHTML = '';

  }


  function openConfirm(
    title,
    msg,
    onYes
  ){

    modalBox.innerHTML =
      '<h3>' +
      esc(title) +
      '</h3>' +

      '<p>' +
      esc(msg) +
      '</p>' +

      '<div class="modal-actions">' +

      '<button class="btn" id="mCancel">' +
      '取消' +
      '</button>' +

      '<button class="btn danger" id="mYes">' +
      '确认' +
      '</button>' +

      '</div>';


    modalOverlay.classList.add(
      'open'
    );


    document
      .getElementById('mCancel')
      .addEventListener(
        'click',
        closeModal
      );


    document
      .getElementById('mYes')
      .addEventListener(
        'click',
        function(){

          closeModal();

          onYes();

        }
      );

  }


  function openPrompt(
    title,
    defVal,
    onOk
  ){

    modalBox.innerHTML =
      '<h3>' +
      esc(title) +
      '</h3>' +

      '<input type="text" id="mInput" value="' +
      esc(defVal) +
      '">' +

      '<div class="modal-actions">' +

      '<button class="btn" id="mCancel">' +
      '取消' +
      '</button>' +

      '<button class="btn primary" id="mOk">' +
      '保存' +
      '</button>' +

      '</div>';


    modalOverlay.classList.add(
      'open'
    );


    var input =
      document.getElementById(
        'mInput'
      );


    setTimeout(
      function(){

        input.focus();
        input.select();

      },
      30
    );


    document
      .getElementById('mCancel')
      .addEventListener(
        'click',
        closeModal
      );


    document
      .getElementById('mOk')
      .addEventListener(
        'click',
        function(){

          var v =
            input.value.trim();


          closeModal();


          if (v){
            onOk(v);
          }

        }
      );

  }


  /* ================= 事件绑定 ================= */

  document
    .getElementById('menuBtn')
    .addEventListener(
      'click',
      openDrawer
    );


  document
    .getElementById('drawerOverlay')
    .addEventListener(
      'click',
      closeDrawer
    );


  qa('.nav-item').forEach(
    function(btn){

      btn.addEventListener(
        'click',
        function(){

          setView(
            btn.getAttribute(
              'data-view'
            )
          );

        }
      );

    }
  );


  document
    .getElementById('wikiTitle')
    .addEventListener(
      'click',
      function(){

        openPrompt(
          '重命名 Wiki',
          state.wikiName,
          function(v){

            state.wikiName = v;

            saveSettings().then(
              function(){

                toast('名称已更新');

                render();

              }
            );

          }
        );

      }
    );


  function goNewPage(){

    state._newTitle = '';

    setView(
      'edit',
      {
        isNew: true
      }
    );

  }


  document
    .getElementById('newBtnTop')
    .addEventListener(
      'click',
      goNewPage
    );


  document
    .getElementById('fab')
    .addEventListener(
      'click',
      goNewPage
    );


  /* ================= 启动 ================= */

  loadAll().then(
    function(){

      var home =
        pageByTitle(
          DEFAULT_HOME_TITLE
        );


      if (home){

        setView(
          'page',
          {
            slug: home.slug
          }
        );

      } else {

        createPage(
          DEFAULT_HOME_TITLE,

          '# 主页\n\n' +
          '欢迎使用本地 md 维基。\n\n' +
          '你可以使用 `[[页面标题]]` 连接到其他页面。'
        ).then(
          function(slug){

            setView(
              'page',
              {
                slug: slug
              }
            );

          }
        );

      }

    }
  );

})();