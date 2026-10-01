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

function initApp(){

    initUI();

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
          '欢迎使用Librum。\n\n' +
          '这是一个使用Markdown语法的本地Wiki。\n\n' +
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


}


if (document.readyState === 'loading'){

  document.addEventListener(
    'DOMContentLoaded',
    initApp
  );

} else {

  initApp();

}
