/*
 * Librum - Lightweight local Markdown Wiki
 *
 * Copyright (C) 2026 Librum Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published
 * by the Free Software Foundation, either version 3 of the License.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

"use strict";


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

var contentEl;
var fabEl;
var modalOverlay;
var modalBox;

function initUI(){

  contentEl = document.getElementById('content');
  fabEl = document.getElementById('fab');
  modalOverlay = document.getElementById('modalOverlay');
  modalBox = document.getElementById('modalBox');

}


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

