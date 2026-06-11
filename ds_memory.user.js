// ==UserScript==
// @name         DeepSeek 记忆助手（空壳版）
// @namespace    http://tampermonkey.net/
// @version      7.0-empty
// @description  可编辑用户记忆+模板按钮管理（空壳版，无预设数据，所有功能保留）
// @match        https://chat.deepseek.com/*
// @match        https://www.deepseek.com/*
// @match        https://deepseek.com/*
// @match        https://*.deepseek.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    const STORAGE_KEY = 'ds_memory_tool_v7';

    // ========== 空壳版：功能板块全保留，数据全空 ==========
    const DEFAULT_DATA = {
        userMemory: '',      // 用户记忆：空，自行填写
        projects: {},        // 项目：空，自行创建
        activeProject: '',   // 当前项目：空
        templates: []       // 模板：空，自行添加
    };

    function loadData() {
        try {
            const saved = GM_getValue(STORAGE_KEY, null);
            if (saved) {
                const data = JSON.parse(saved);
                // 确保所有字段存在，兼容旧版
                if (data.userMemory === undefined) data.userMemory = '';
                if (!data.projects) data.projects = {};
                if (!data.activeProject) data.activeProject = '';
                if (!data.templates) data.templates = [];
                return data;
            }
        } catch(e) {}
        // 首次使用：返回空壳默认值
        return JSON.parse(JSON.stringify(DEFAULT_DATA));
    }

    function saveData(data) {
        GM_setValue(STORAGE_KEY, JSON.stringify(data));
    }

    let appData = loadData();
    let panelVisible = false;

    // 工具函数
    function copyToClipboard(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textarea);
        return success;
    }

    function showToast(msg) {
        let toast = document.getElementById('ds-mem-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'ds-mem-toast';
            toast.style.cssText = `
                position: fixed;
                bottom: 80px;
                right: 20px;
                z-index: 2147483647;
                background: #2A9D8F;
                color: white;
                padding: 10px 20px;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 600;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                opacity: 0;
                transition: opacity 0.3s;
                pointer-events: none;
                font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
            `;
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        toast.style.opacity = '1';
        setTimeout(() => toast.style.opacity = '0', 2000);
    }

    function getActiveProject() {
        return appData.projects[appData.activeProject] || {
            current: '⏳ 新任务（请编辑）',
            completed: '',
            memory: ''
        };
    }

    function buildFullMemory() {
        let result = '';
        if (appData.userMemory) result += appData.userMemory + '

';
        const proj = getActiveProject();
        if (proj.completed) result += proj.completed + '
';
        if (proj.current && proj.current !== '⏳ 新任务（请编辑）') result += proj.current + '

';
        if (proj.memory) result += proj.memory;
        return result.trim();
    }

    // ====== 小脑袋图标 ======
    function createIcon() {
        if (document.getElementById('ds-mem-icon')) return;
        const icon = document.createElement('div');
        icon.id = 'ds-mem-icon';
        icon.innerHTML = '🧠';
        icon.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 2147483647;
            width: 48px;
            height: 48px;
            background: #E8853B;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            cursor: pointer;
            box-shadow: 0 4px 16px rgba(232,133,59,0.4);
            transition: transform 0.2s;
            user-select: none;
        `;
        icon.onmouseenter = () => icon.style.transform = 'scale(1.1)';
        icon.onmouseleave = () => icon.style.transform = 'scale(1)';
        icon.onclick = (e) => { e.stopPropagation(); togglePanel(); };
        document.body.appendChild(icon);
    }

    // ====== 创建面板 ======
    function createPanel() {
        if (document.getElementById('ds-memory-panel')) return;

        const panel = document.createElement('div');
        panel.id = 'ds-memory-panel';
        panel.style.cssText = `
            position: fixed;
            bottom: 80px;
            right: 20px;
            z-index: 2147483646;
            background: #264653;
            color: #eee;
            border-radius: 16px;
            padding: 16px;
            width: 420px;
            max-height: calc(100vh - 100px);
            overflow-y: auto;
            box-shadow: 0 12px 40px rgba(0,0,0,0.3);
            font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
            font-size: 13px;
            line-height: 1.6;
            display: ${panelVisible ? 'block' : 'none'};
        `;

        // 模板按钮HTML - 空壳状态
        const hasTemplates = appData.templates && appData.templates.length > 0;
        const templateButtons = hasTemplates 
            ? appData.templates.map((t, i) => `
                <div style="display:flex;gap:4px;margin-bottom:4px;">
                    <button class="ds-template-btn" data-idx="${i}" style="flex:1;padding:6px 10px;background:#1a1a2e;border:1px solid #E8853B;border-radius:6px;color:#E9C46A;cursor:pointer;text-align:left;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                        ${t.name}
                    </button>
                    <button class="ds-del-template" data-idx="${i}" style="padding:6px 8px;background:#C6282820;border:1px solid #C62828;border-radius:6px;color:#C62828;cursor:pointer;font-size:12px;">×</button>
                </div>
            `).join('')
            : '<div style="color:#888;font-size:12px;padding:8px;text-align:center;border:1px dashed #444;border-radius:6px;">📝 暂无模板<br>点击右上角「+ 添加」创建你的第一个模板</div>';

        // 项目选项 - 空壳状态
        const hasProjects = Object.keys(appData.projects).length > 0;
        const projectOptions = hasProjects
            ? Object.keys(appData.projects).map(name => 
                `<option value="${name}" ${name === appData.activeProject ? 'selected' : ''}>${name}</option>`
              ).join('')
            : '<option value="" disabled selected>📂 请先创建项目</option>';

        panel.innerHTML = `
            <!-- 头部 -->
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                <span style="font-weight:700;font-size:15px;color:#E9C46A;">🧠 记忆助手 v7.0</span>
                <button id="ds-close-panel" style="background:none;border:none;color:#E9C46A;cursor:pointer;font-size:18px;">×</button>
            </div>

            <!-- 用户记忆（可编辑） -->
            <div style="margin-bottom:14px;">
                <div style="font-weight:700;color:#E8853B;margin-bottom:6px;font-size:13px;display:flex;justify-content:space-between;align-items:center;">
                    <span>👤 用户记忆（让DS认识你）</span>
                    <button id="ds-save-user" style="padding:2px 8px;background:#E8853B;color:white;border:none;border-radius:4px;cursor:pointer;font-size:11px;">保存</button>
                </div>
                <textarea id="ds-user-input" placeholder="在此填写你的基本信息，例如：
- 我是XX老师，教XX学科
- 我的教学风格/偏好
- 常用平台/工具..." style="width:100%;min-height:60px;background:#1a1a2e;border:1.5px solid #E8853B;border-radius:8px;color:#E9C46A;padding:8px;font-size:12px;resize:vertical;box-sizing:border-box;">${appData.userMemory || ''}</textarea>
            </div>

            <!-- 项目切换 -->
            <div style="margin-bottom:10px;">
                <div style="font-weight:700;color:#2A9D8F;margin-bottom:4px;font-size:12px;">📁 项目</div>
                <div style="display:flex;gap:6px;">
                    <select id="ds-project-select" style="flex:1;padding:6px;background:#1a1a2e;border:1px solid #2A9D8F;border-radius:6px;color:#E9C46A;font-size:12px;cursor:pointer;">
                        ${projectOptions}
                        <option value="__new__">+ 新建项目...</option>
                    </select>
                    <button id="ds-copy-all" style="padding:6px 12px;background:#C62828;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:600;font-size:12px;">📋 复制全部</button>
                </div>
            </div>

            <!-- 当前进度（可编辑） -->
            <div style="margin-bottom:10px;">
                <div style="font-weight:700;color:#2A9D8F;margin-bottom:4px;font-size:12px;">📍 当前进度</div>
                <textarea id="ds-current-input" placeholder="当前正在进行的任务..." style="width:100%;min-height:40px;background:#1a1a2e;border:1px solid #2A9D8F;border-radius:6px;color:#E9C46A;padding:6px;font-size:12px;resize:vertical;box-sizing:border-box;">${getActiveProject().current}</textarea>
            </div>

            <!-- 已完成 -->
            <div style="margin-bottom:10px;">
                <div style="font-weight:700;color:#E9C46A;margin-bottom:4px;font-size:12px;display:flex;justify-content:space-between;align-items:center;">
                    <span>📋 已完成</span>
                    <button id="ds-done-btn" style="padding:2px 8px;background:#2A9D8F;color:white;border:none;border-radius:4px;cursor:pointer;font-size:11px;">标记完成</button>
                </div>
                <div id="ds-completed-box" style="background:#1a1a2e;border-radius:6px;padding:8px;max-height:80px;overflow-y:auto;font-size:11px;color:#aaa;line-height:1.8;">
                    ${getActiveProject().completed ? getActiveProject().completed.replace(/
/g, '<br>') : '<span style="color:#666;">暂无已完成任务</span>'}
                </div>
            </div>

            <!-- 项目核心记忆 -->
            <div style="margin-bottom:10px;">
                <div style="font-weight:700;color:#E8853B;margin-bottom:4px;font-size:12px;">📝 项目核心记忆</div>
                <textarea id="ds-memory-input" placeholder="项目相关的核心记忆、规范、要求、素材..." style="width:100%;min-height:60px;background:#1a1a2e;border:1px solid #E8853B;border-radius:6px;color:#E9C46A;padding:6px;font-size:12px;resize:vertical;box-sizing:border-box;">${getActiveProject().memory}</textarea>
            </div>

            <!-- 保存项目 -->
            <div style="margin-bottom:14px;">
                <button id="ds-save-project" style="width:100%;padding:6px;background:#E8853B;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:600;font-size:12px;">💾 保存项目进度</button>
            </div>

            <!-- 模板按钮区 -->
            <div style="margin-bottom:10px;padding-top:10px;border-top:1px solid #333;">
                <div style="font-weight:700;color:#E9C46A;margin-bottom:8px;font-size:13px;display:flex;justify-content:space-between;align-items:center;">
                    <span>🎯 快捷模板（点击复制）</span>
                    <button id="ds-add-template" style="padding:2px 8px;background:#2A9D8F;color:white;border:none;border-radius:4px;cursor:pointer;font-size:11px;">+ 添加</button>
                </div>
                <div id="ds-template-list">
                    ${templateButtons}
                </div>
            </div>

            <div style="font-size:10px;color:#888;text-align:center;margin-top:8px;">
                点击🧠关闭面板 · 所有数据保存在本地浏览器
            </div>
        `;

        document.body.appendChild(panel);

        // 关闭
        document.getElementById('ds-close-panel').onclick = (e) => {
            e.stopPropagation();
            hidePanel();
        };

        // 保存用户记忆
        document.getElementById('ds-save-user').onclick = (e) => {
            e.stopPropagation();
            appData.userMemory = document.getElementById('ds-user-input').value;
            saveData(appData);
            showToast('✅ 用户记忆已保存！');
        };

        // 项目切换
        document.getElementById('ds-project-select').onchange = function(e) {
            const val = e.target.value;
            if (val === '__new__') {
                const name = prompt('新项目名称：');
                if (name && !appData.projects[name]) {
                    appData.projects[name] = { current: '⏳ 新任务', completed: '', memory: '' };
                    appData.activeProject = name;
                    saveData(appData);
                    refreshPanel();
                    showToast('✅ 项目已创建！');
                }
            } else if (val) {
                appData.activeProject = val;
                saveData(appData);
                refreshPanel();
            }
        };

        // 保存项目
        document.getElementById('ds-save-project').onclick = (e) => {
            e.stopPropagation();
            const proj = appData.projects[appData.activeProject];
            if (proj) {
                proj.current = document.getElementById('ds-current-input').value;
                proj.memory = document.getElementById('ds-memory-input').value;
                saveData(appData);
                showToast('✅ 项目进度已保存！');
            } else {
                showToast('⚠️ 请先创建项目');
            }
        };

        // 标记完成
        document.getElementById('ds-done-btn').onclick = (e) => {
            e.stopPropagation();
            const current = document.getElementById('ds-current-input').value.trim();
            if (!current || current === '⏳ 新任务（请编辑）') {
                showToast('⚠️ 请先填写当前任务');
                return;
            }
            const doneLine = current.replace(/⏳/g, '✅').replace(/🔄/g, '✅');
            const proj = getActiveProject();
            proj.completed = proj.completed ? proj.completed + '
' + doneLine : doneLine;
            proj.current = '⏳ 新任务（请编辑）';
            saveData(appData);
            refreshPanel();
            showToast('✅ 已标记完成！');
        };

        // 复制全部
        document.getElementById('ds-copy-all').onclick = (e) => {
            e.stopPropagation();
            const full = buildFullMemory();
            if (full && copyToClipboard(full)) {
                showToast('✅ 完整记忆已复制！');
            } else {
                showToast('⚠️ 没有内容可复制，请先填写记忆');
            }
        };

        // 模板按钮 - 复制
        document.querySelectorAll('.ds-template-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.dataset.idx);
                const t = appData.templates[idx];
                if (t && copyToClipboard(t.content)) {
                    showToast(`✅ ${t.name} 已复制！`);
                }
            };
        });

        // 模板按钮 - 删除
        document.querySelectorAll('.ds-del-template').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.dataset.idx);
                if (confirm('删除这个模板？')) {
                    appData.templates.splice(idx, 1);
                    saveData(appData);
                    refreshPanel();
                }
            };
        });

        // 添加模板
        document.getElementById('ds-add-template').onclick = (e) => {
            e.stopPropagation();
            const name = prompt('模板名称（如：📝 写作模板）：');
            if (!name) return;
            const content = prompt('模板内容（粘贴你的常用指令）：');
            if (!content) return;
            appData.templates.push({ name, content });
            saveData(appData);
            refreshPanel();
            showToast('✅ 模板已添加！');
        };

        document.addEventListener('click', closeOnClickOutside);
    }

    function closeOnClickOutside(e) {
        const panel = document.getElementById('ds-memory-panel');
        const icon = document.getElementById('ds-mem-icon');
        if (panel && panelVisible && !panel.contains(e.target) && !icon.contains(e.target)) {
            hidePanel();
        }
    }

    function togglePanel() {
        panelVisible = !panelVisible;
        const panel = document.getElementById('ds-memory-panel');
        if (panel) panel.style.display = panelVisible ? 'block' : 'none';
        else if (panelVisible) createPanel();
    }

    function hidePanel() {
        panelVisible = false;
        const panel = document.getElementById('ds-memory-panel');
        if (panel) panel.style.display = 'none';
    }

    function refreshPanel() {
        const old = document.getElementById('ds-memory-panel');
        if (old) {
            old.remove();
            document.removeEventListener('click', closeOnClickOutside);
        }
        if (panelVisible) createPanel();
    }

    setTimeout(() => {
        createIcon();
        if (panelVisible) createPanel();
    }, 2000);

    console.log('[DS Memory v7.0-empty] 空壳版已加载，无预设数据，所有功能可用');
})();
