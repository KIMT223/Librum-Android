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

    var exists = !!pageByTitle(link.title);

    var cls = 'wiki-link ' +
      (exists ? 'wiki-link-exists' : 'wiki-link-missing');

    return '<a href="#" class="' + cls + '" data-wiki-title="' +
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

