// ===== 待办事项应用逻辑 =====
(function () {
  "use strict";

  const STORAGE_KEY = "todoApp.tasks";
  const DEFAULT_PRIORITY = "low";
  const PRIORITY_LABELS = { high: "高", medium: "中", low: "低" };

  // DOM 引用
  const form = document.getElementById("todoForm");
  const input = document.getElementById("todoInput");
  const addBtn = document.getElementById("addBtn");
  const priorityButtons = document.querySelectorAll(".pri-btn");
  const lists = document.getElementById("lists");
  const emptyState = document.getElementById("emptyState");
  const pendingList = document.getElementById("pendingList");
  const completedList = document.getElementById("completedList");
  const completedSection = document.getElementById("completedSection");
  const clearCompletedBtn = document.getElementById("clearCompletedBtn");
  const clearAllBtn = document.getElementById("clearAllBtn");
  const emptyPendingTip = document.getElementById("emptyPendingTip");
  const totalEl = document.getElementById("totalCount");
  const pendingEl = document.getElementById("pendingCount");
  const completedEl = document.getElementById("completedCount");
  const pendingSectionCount = document.getElementById("pendingSectionCount");
  const completedSectionCount = document.getElementById("completedSectionCount");

  // 任务数据：[{ id, text, completed, priority }]
  let tasks = loadTasks();
  let currentPriority = DEFAULT_PRIORITY;

  // ---------- 本地存储 ----------
  function loadTasks() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const data = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(data)) return [];
      // 兼容旧数据：缺少 priority 字段的任务默认为"低"
      return data.map((t) => ({
        id: String(t.id),
        text: String(t.text || ""),
        completed: !!t.completed,
        priority: PRIORITY_LABELS[t.priority] ? t.priority : DEFAULT_PRIORITY,
      }));
    } catch (e) {
      console.warn("读取本地数据失败，已重置：", e);
      return [];
    }
  }

  function saveTasks() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch (e) {
      console.warn("保存本地数据失败：", e);
    }
  }

  // ---------- 工具 ----------
  // 转义 HTML，防止把用户输入当作标签解析
  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  function createTaskId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function findItem(id) {
    return (
      pendingList.querySelector(`[data-id="${id}"]`) ||
      completedList.querySelector(`[data-id="${id}"]`)
    );
  }

  // ---------- 渲染 ----------
  function buildItem(task) {
    const li = document.createElement("li");
    li.className =
      "todo-item priority-" + task.priority + (task.completed ? " completed" : "");
    li.dataset.id = task.id;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = task.completed;
    checkbox.setAttribute("aria-label", "标记完成：" + task.text);

    const span = document.createElement("span");
    span.className = "todo-text";
    span.innerHTML = escapeHtml(task.text);

    const badge = document.createElement("span");
    badge.className = "priority-badge priority-" + task.priority;
    badge.textContent = PRIORITY_LABELS[task.priority];

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "btn-edit";
    editBtn.title = "编辑任务";
    editBtn.setAttribute("aria-label", "编辑任务：" + task.text);
    editBtn.textContent = "✎";

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "btn-delete";
    delBtn.title = "删除任务";
    delBtn.setAttribute("aria-label", "删除任务：" + task.text);
    delBtn.textContent = "✕";

    li.append(checkbox, span, badge, editBtn, delBtn);
    return li;
  }

  // 按完成状态分到两个列表
  function render() {
    pendingList.innerHTML = "";
    completedList.innerHTML = "";

    tasks.forEach((task) => {
      const li = buildItem(task);
      if (task.completed) {
        completedList.appendChild(li);
      } else {
        pendingList.appendChild(li);
      }
    });

    updateStats();
    updateVisibility();
  }

  function updateStats() {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.completed).length;
    const pending = total - completed;

    totalEl.textContent = total;
    pendingEl.textContent = pending;
    completedEl.textContent = completed;
    pendingSectionCount.textContent = pending;
    completedSectionCount.textContent = completed;
  }

  function updateVisibility() {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.completed).length;
    const pending = total - completed;

    // 整个清单为空：隐藏列表，显示友好提示
    lists.classList.toggle("hidden", total === 0);
    emptyState.classList.toggle("hidden", total > 0);
    clearAllBtn.disabled = total === 0;

    // 没有已完成任务：隐藏已完成区块、禁用清空按钮
    completedSection.classList.toggle("hidden", completed === 0);
    clearCompletedBtn.disabled = completed === 0;

    // 进行中列表的提示（全部完成时显示）
    emptyPendingTip.classList.toggle("hidden", pending > 0);
  }

  // ---------- 操作 ----------
  function addTask(text) {
    const trimmed = text.trim();
    if (!trimmed) return;

    tasks.push({
      id: createTaskId(),
      text: trimmed,
      completed: false,
      priority: currentPriority,
    });
    saveTasks();
    render();
  }

  function toggleTask(id) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;

    task.completed = !task.completed;
    saveTasks();
    render();
  }

  // 行内编辑：点击 ✎ 后把文字替换成输入框
  function startEdit(id) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;

    const item = findItem(id);
    if (!item) return;

    const span = item.querySelector(".todo-text");
    const editInput = document.createElement("input");
    editInput.type = "text";
    editInput.className = "edit-input";
    editInput.value = task.text;
    editInput.maxLength = 200;

    span.replaceWith(editInput);
    editInput.focus();
    editInput.select();

    let settled = false;
    function commit(save) {
      if (settled) return;
      settled = true;
      const newText = editInput.value.trim();
      if (save && newText && newText !== task.text) {
        task.text = newText;
        saveTasks();
      }
      render(); // 无论保存还是取消都恢复显示
    }

    editInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commit(true);
      } else if (e.key === "Escape") {
        commit(false);
      }
    });
    editInput.addEventListener("blur", () => commit(true));
  }

  function removeTask(id) {
    const item = findItem(id);
    if (item) {
      // 先播放淡出动画再移除
      item.classList.add("removing");
      setTimeout(() => {
        tasks = tasks.filter((t) => t.id !== id);
        saveTasks();
        render();
      }, 200);
    } else {
      tasks = tasks.filter((t) => t.id !== id);
      saveTasks();
      render();
    }
  }

  // 清空所有已完成任务
  function clearCompleted() {
    if (!tasks.some((t) => t.completed)) return;

    const items = completedList.querySelectorAll(".todo-item");
    items.forEach((item) => item.classList.add("removing"));

    setTimeout(() => {
      tasks = tasks.filter((t) => !t.completed);
      saveTasks();
      render();
    }, 200);
  }

  // 清空全部（带确认）
  function clearAll() {
    if (tasks.length === 0) return;
    const ok = confirm("确定要清空所有任务吗？此操作不可恢复！");
    if (!ok) return;

    const items = document.querySelectorAll(".todo-item");
    items.forEach((item) => item.classList.add("removing"));

    setTimeout(() => {
      tasks = [];
      saveTasks();
      render();
    }, 200);
  }

  // ---------- 事件绑定 ----------
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    addTask(input.value);
    input.value = "";
    input.focus();
  });

  input.addEventListener("input", () => {
    addBtn.disabled = input.value.trim() === "";
  });

  // 优先级选择
  priorityButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      currentPriority = btn.dataset.priority;
      priorityButtons.forEach((b) => b.classList.toggle("active", b === btn));
    });
  });

  // 事件委托：两个列表共用（复选框、编辑、删除）
  function handleListClick(e) {
    const li = e.target.closest("li.todo-item");
    if (!li) return;
    const id = li.dataset.id;

    if (e.target.type === "checkbox") {
      toggleTask(id);
    } else if (e.target.classList.contains("btn-edit")) {
      startEdit(id);
    } else if (e.target.classList.contains("btn-delete")) {
      removeTask(id);
    }
  }

  pendingList.addEventListener("click", handleListClick);
  completedList.addEventListener("click", handleListClick);

  clearCompletedBtn.addEventListener("click", clearCompleted);
  clearAllBtn.addEventListener("click", clearAll);

  // ---------- 初始化 ----------
  addBtn.disabled = input.value.trim() === "";
  render();
})();
