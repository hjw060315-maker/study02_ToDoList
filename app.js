const STORAGE_KEY = "todo-app-v1";
const CATEGORIES = { work: "업무", personal: "개인", study: "공부" };

const $ = (id) => document.getElementById(id);

let state = { todos: [], lastCategory: "work" };
let filter = "all";
let editingId = null;

// ---------- 저장 / 복원 ----------
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (data && Array.isArray(data.todos)) {
      state.todos = data.todos.filter(
        (t) => t && typeof t.id === "string" && typeof t.text === "string" && t.category in CATEGORIES
      );
    }
    if (data && data.lastCategory in CATEGORIES) state.lastCategory = data.lastCategory;
  } catch (e) {
    state = { todos: [], lastCategory: "work" };
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    $("storage-warning").hidden = true;
  } catch (e) {
    $("storage-warning").hidden = false;
  }
}

function commit() {
  save();
  render();
}

// ---------- 상태 변경 ----------
function addTodo(text, category) {
  text = text.trim().slice(0, 100);
  if (!text) return false;
  state.todos.push({ id: crypto.randomUUID(), text, category, done: false, createdAt: Date.now() });
  state.lastCategory = category;
  if (filter !== "all" && filter !== category) filter = category;
  commit();
  return true;
}

function updateTodo(id, changes) {
  const todo = state.todos.find((t) => t.id === id);
  if (todo) Object.assign(todo, changes);
  commit();
}

function deleteTodo(id) {
  if (!confirm("이 할 일을 삭제할까요?")) return;
  state.todos = state.todos.filter((t) => t.id !== id);
  commit();
}

function clearDone() {
  if (!confirm("완료한 항목을 모두 삭제할까요?")) return;
  state.todos = state.todos.filter((t) => !t.done);
  commit();
}

// ---------- 렌더링 ----------
function percent(done, total) {
  return total ? Math.round((done / total) * 100) : 0;
}

function stats(list) {
  const done = list.filter((t) => t.done).length;
  return { done, total: list.length, pct: percent(done, list.length) };
}

function renderProgress(visible) {
  const s = stats(visible);
  $("progress-text").textContent = `완료 ${s.done} / 전체 ${s.total} (${s.pct}%)`;
  $("progress-fill").style.width = s.pct + "%";

  const mini = $("mini-progress");
  mini.replaceChildren();
  for (const [key, label] of Object.entries(CATEGORIES)) {
    const c = stats(state.todos.filter((t) => t.category === key));
    const li = document.createElement("li");
    li.textContent = `${label} ${c.done}/${c.total}`;
    const bar = document.createElement("div");
    bar.className = "bar";
    const fill = document.createElement("div");
    fill.className = "bar-fill";
    fill.style.width = c.pct + "%";
    fill.style.background = `var(--${key})`;
    bar.append(fill);
    li.append(bar);
    mini.append(li);
  }
}

function createTodoItem(todo) {
  const li = document.createElement("li");
  li.className = "todo" + (todo.done ? " done" : "");

  const check = document.createElement("input");
  check.type = "checkbox";
  check.checked = todo.done;
  check.id = "chk-" + todo.id;
  check.addEventListener("change", () => updateTodo(todo.id, { done: check.checked }));
  li.append(check);

  if (editingId === todo.id) {
    li.append(...createEditControls(todo));
    return li;
  }

  check.setAttribute("aria-label", todo.text);
  const label = document.createElement("span");
  label.className = "text";
  label.textContent = todo.text;
  label.addEventListener("dblclick", () => startEdit(todo.id));
  li.append(label);

  const badge = document.createElement("span");
  badge.className = "badge " + todo.category;
  badge.textContent = CATEGORIES[todo.category];
  li.append(badge);

  const edit = document.createElement("button");
  edit.type = "button";
  edit.textContent = "수정";
  edit.addEventListener("click", () => startEdit(todo.id));
  const del = document.createElement("button");
  del.type = "button";
  del.textContent = "삭제";
  del.addEventListener("click", () => deleteTodo(todo.id));
  li.append(edit, del);
  return li;
}

function createEditControls(todo) {
  const input = document.createElement("input");
  input.type = "text";
  input.className = "edit-input";
  input.maxLength = 100;
  input.value = todo.text;
  input.setAttribute("aria-label", "할 일 수정");

  const select = $("add-category").cloneNode(true);
  select.removeAttribute("id");
  select.value = todo.category;

  const saveEdit = () => {
    const text = input.value.trim();
    if (!text) return;
    editingId = null;
    updateTodo(todo.id, { text, category: select.value });
  };
  const cancel = () => {
    editingId = null;
    render();
  };
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") saveEdit();
    else if (e.key === "Escape") cancel();
  });

  const ok = document.createElement("button");
  ok.type = "button";
  ok.textContent = "저장";
  ok.addEventListener("click", saveEdit);
  const no = document.createElement("button");
  no.type = "button";
  no.textContent = "취소";
  no.addEventListener("click", cancel);

  setTimeout(() => input.focus(), 0);
  return [input, select, ok, no];
}

function startEdit(id) {
  editingId = id;
  render();
}

function render() {
  const visible = filter === "all" ? state.todos : state.todos.filter((t) => t.category === filter);

  document.querySelectorAll("#tabs button").forEach((b) => {
    b.classList.toggle("active", b.dataset.filter === filter);
  });

  renderProgress(visible);

  $("todo-list").replaceChildren(...visible.map(createTodoItem));
  $("empty").hidden = visible.length > 0;
  $("clear-done").disabled = !state.todos.some((t) => t.done);
  $("add-category").value = state.lastCategory;
}

// ---------- 초기화 ----------
function init() {
  $("today").textContent = new Date().toLocaleDateString("ko-KR", {
    year: "numeric", month: "long", day: "numeric", weekday: "long",
  });

  $("add-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = $("add-text");
    if (addTodo(input.value, $("add-category").value)) input.value = "";
    input.focus();
  });
  $("tabs").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-filter]");
    if (!btn) return;
    filter = btn.dataset.filter;
    render();
  });
  $("clear-done").addEventListener("click", clearDone);

  load();
  save();
  render();
}

init();
