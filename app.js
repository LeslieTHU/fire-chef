/* ============================================================
   🔥 火爆厨神 — 主控逻辑 (Vanilla JS SPA)
   ============================================================ */

(() => {
  'use strict';

  // ── 数据源配置 ──────────────────────────────────────
  const DATA_FILES = [
    { file: 'data/stir_fry.json', icon: '🔥' },
    { file: 'data/braised.json',  icon: '🍲' },
    { file: 'data/cold_dish.json', icon: '🥒' },
    { file: 'data/healthy.json',  icon: '🥗' }
  ];

  // ── 全局状态 ──────────────────────────────────────
  let allCategories = [];   // 所有分类数据
  let activeIndex = 0;      // 当前激活分类索引
  let isChefMode = false;   // 主厨模式标记

  // ── DOM 引用 ──────────────────────────────────────
  const $ = (sel) => document.querySelector(sel);
  const chefBanner   = $('#chef-banner');
  const categoryNav  = $('#category-nav');
  const categoryTitle = $('#category-title');
  const categoryDesc  = $('#category-desc');
  const recipeGrid   = $('#recipe-grid');
  const menuToggle   = $('#menu-toggle');
  const sidebar      = $('#sidebar');
  const sidebarOverlay = $('#sidebar-overlay');
  const toastEl      = $('#toast');

  // ── 鉴权检查 ──────────────────────────────────────
  function checkChefMode() {
    const params = new URLSearchParams(window.location.search);
    isChefMode = params.get('mode') === 'chef';

    if (isChefMode) {
      chefBanner.classList.remove('hidden');
      document.body.classList.add('chef-mode');
    } else {
      chefBanner.classList.add('hidden');
      document.body.classList.remove('chef-mode');
    }
  }

  // ── 数据加载 ──────────────────────────────────────
  async function loadAllData() {
    const results = await Promise.allSettled(
      DATA_FILES.map(async ({ file, icon }) => {
        const res = await fetch(file);
        if (!res.ok) throw new Error(`Failed to load ${file}`);
        const data = await res.json();
        data._icon = icon;
        return data;
      })
    );

    allCategories = results
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value);

    if (allCategories.length === 0) {
      categoryTitle.textContent = '数据加载失败 😢';
      categoryDesc.textContent = '请检查 data/ 目录下的 JSON 文件是否存在。';
      return;
    }

    renderSidebar();
    switchCategory(0);
  }

  // ── 侧边栏渲染 ──────────────────────────────────────
  function renderSidebar() {
    categoryNav.innerHTML = '';

    allCategories.forEach((cat, idx) => {
      const btn = document.createElement('button');
      btn.className = `nav-btn${idx === activeIndex ? ' active' : ''}`;
      btn.innerHTML = `<span class="nav-icon">${cat._icon}</span>${cat.category}`;
      btn.addEventListener('click', () => {
        switchCategory(idx);
        closeMobileMenu();
      });
      categoryNav.appendChild(btn);
    });
  }

  // ── 分类切换 ──────────────────────────────────────
  function switchCategory(idx) {
    activeIndex = idx;
    const cat = allCategories[idx];

    // 更新导航高亮
    categoryNav.querySelectorAll('.nav-btn').forEach((btn, i) => {
      btn.classList.toggle('active', i === idx);
    });

    // 更新标题区
    categoryTitle.textContent = `${cat._icon} ${cat.category}`;
    categoryDesc.textContent = cat.description;

    // 渲染卡片
    renderRecipes(cat.recipes);
  }

  // ── 菜品卡片渲染 ──────────────────────────────────
  function renderRecipes(recipes) {
    recipeGrid.innerHTML = '';

    recipes.forEach(recipe => {
      const card = document.createElement('article');
      card.className = 'recipe-card';
      card.innerHTML = buildCardHTML(recipe);
      recipeGrid.appendChild(card);
    });

    // 绑定复制按钮事件
    recipeGrid.querySelectorAll('.copy-btn').forEach(btn => {
      btn.addEventListener('click', handleCopy);
    });
  }

  // ── 构建单张卡片 HTML ─────────────────────────────
  function buildCardHTML(recipe) {
    let html = '';

    // 图片区
    if (recipe.image_url && recipe.image_url.trim() !== '') {
      html += `<img class="card-image" src="${escapeHtml(recipe.image_url)}" alt="${escapeHtml(recipe.name)}" loading="lazy" onerror="this.outerHTML='<div class=\\'card-image-placeholder\\'>🍳</div>'">`;
    } else {
      html += `<div class="card-image-placeholder">🍳</div>`;
    }

    html += `<div class="card-body">`;

    // 标题 + 菜系徽章
    const badgeClass = `badge badge-${recipe.region}`;
    html += `
      <div class="card-title-row">
        <span class="card-name">${escapeHtml(recipe.name)}</span>
        <span class="${badgeClass}">${escapeHtml(recipe.region)}</span>
      </div>`;

    // 难度 & 耗时
    html += `
      <div class="card-meta">
        <span>🎯 ${escapeHtml(recipe.difficulty)}</span>
        <span>⏱️ ${escapeHtml(recipe.time)}</span>
      </div>`;

    // 备菜材料 (始终显示)
    html += `<div class="ingredients-section">`;
    html += `<div class="section-label">📋 备菜清单</div>`;

    if (recipe.ingredients.main && recipe.ingredients.main.length) {
      html += `
        <div class="ingredient-group">
          <div class="ingredient-group-title">主料</div>
          <div class="ingredient-list">
            ${recipe.ingredients.main.map(i => `<span class="ingredient-tag">${escapeHtml(i)}</span>`).join('')}
          </div>
        </div>`;
    }

    if (recipe.ingredients.seasoning && recipe.ingredients.seasoning.length) {
      html += `
        <div class="ingredient-group">
          <div class="ingredient-group-title">辅料 / 调料</div>
          <div class="ingredient-list">
            ${recipe.ingredients.seasoning.map(i => `<span class="ingredient-tag">${escapeHtml(i)}</span>`).join('')}
          </div>
        </div>`;
    }

    // 一键复制采购按钮 (仅访客模式)
    if (!isChefMode) {
      html += `
        <button class="copy-btn" data-recipe='${escapeAttr(JSON.stringify({
          name: recipe.name,
          main: recipe.ingredients.main,
          seasoning: recipe.ingredients.seasoning
        }))}'>
          📋 一键复制采购清单
        </button>`;
    }

    html += `</div>`; // end ingredients-section

    // ── 主厨模式独有内容 ──
    if (isChefMode) {
      // 做法步骤
      if (recipe.steps && recipe.steps.length) {
        html += `
          <div class="steps-section">
            <div class="section-label">👨‍🍳 做法步骤</div>
            <ol class="steps-list">
              ${recipe.steps.map(s => `<li>${escapeHtml(s)}</li>`).join('')}
            </ol>
          </div>`;
      }

      // 避坑指南
      if (recipe.tips) {
        html += `
          <div class="tips-section">
            <div class="section-label">⚠️ 避坑指南</div>
            <p class="tips-content">${escapeHtml(recipe.tips)}</p>
          </div>`;
      }
    }

    html += `</div>`; // end card-body
    return html;
  }

  // ── 一键复制采购清单 ──────────────────────────────
  function handleCopy(e) {
    const btn = e.currentTarget;
    const data = JSON.parse(btn.dataset.recipe);

    let text = `【🔥火爆厨神采购任务】 — ${data.name}\n`;
    text += `${'─'.repeat(30)}\n`;

    if (data.main && data.main.length) {
      text += `\n🥩 主料：\n`;
      data.main.forEach((item, i) => {
        text += `  ${i + 1}. ${item}\n`;
      });
    }

    if (data.seasoning && data.seasoning.length) {
      text += `\n🧂 辅料/调料：\n`;
      data.seasoning.forEach((item, i) => {
        text += `  ${i + 1}. ${item}\n`;
      });
    }

    text += `\n${'─'.repeat(30)}\n`;
    text += `来自「火爆厨神」极客菜谱库 🔥`;

    navigator.clipboard.writeText(text).then(() => {
      showToast('✅ 采购清单已复制到剪贴板！');
    }).catch(() => {
      // Fallback for older browsers
      fallbackCopy(text);
      showToast('✅ 采购清单已复制到剪贴板！');
    });
  }

  // Clipboard fallback
  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }

  // ── Toast 通知 ──────────────────────────────────────
  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.remove('hidden');
    toastEl.classList.add('show');
    setTimeout(() => {
      toastEl.classList.remove('show');
    }, 2000);
  }

  // ── 移动端菜单 ──────────────────────────────────────
  function openMobileMenu() {
    sidebar.classList.add('open');
    sidebarOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeMobileMenu() {
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  menuToggle.addEventListener('click', () => {
    if (sidebar.classList.contains('open')) {
      closeMobileMenu();
    } else {
      openMobileMenu();
    }
  });

  sidebarOverlay.addEventListener('click', closeMobileMenu);

  // ── 安全工具函数 ──────────────────────────────────
  function escapeHtml(str) {
    if (typeof str !== 'string') return str;
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return str.replace(/[&<>"']/g, c => map[c]);
  }

  function escapeAttr(str) {
    return str.replace(/'/g, '&#39;').replace(/"/g, '&quot;');
  }

  // ── 启动 ──────────────────────────────────────────
  checkChefMode();
  loadAllData();

})();
