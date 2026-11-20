import './style.css';
import { createPipelineScene } from './scene.js';

const select = document.querySelector('#pipeline-select');
const form = document.querySelector('#pipeline-form');
const vertices = document.querySelector('#vertices');
const threshold = document.querySelector('#threshold');
const analyzeButton = document.querySelector('#analyze');
const results = document.querySelector('#results');
const resultMessage = document.querySelector('#result-message');
const summary = document.querySelector('#result-summary');
const status = document.querySelector('#editor-status');
const sceneMessage = document.querySelector('#scene-message');
const panel = document.querySelector('.analysis-panel');
const panelResizer = document.querySelector('#panel-resizer');

let pipelines = [];
let selectedId = null;
let mode = 'view';
let busy = false;
let clearances = null;
let activeTargetId = null;
let analysisRequest = null;
let activeVertex = 0;
let pipelineScene;

/** 读取接口响应，写入请求统一发送 JSON。 */
async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  const body = await response.json();
  if (!response.ok || body.code < 200 || body.code >= 300) {
    throw new Error(body.message || `请求失败（HTTP ${response.status}）`);
  }
  return body.data;
}

/** 显示保存状态或具体输入错误。 */
function showStatus(message = '', error = false) {
  status.textContent = message;
  status.hidden = !message;
  status.classList.toggle('error', error);
}

/** 重建下拉选项，编辑期间固定当前对象。 */
function renderSelect() {
  select.replaceChildren();
  for (const pipeline of pipelines) {
    select.add(new Option(pipeline.name, String(pipeline.id)));
  }
  if (mode === 'new') select.add(new Option('新建管线', 'new'));
  if (!pipelines.length && mode !== 'new') select.add(new Option('暂无管线', ''));
  select.value = mode === 'new' ? 'new' : String(selectedId ?? '');
  document.querySelector('#pipeline-count').textContent = `${pipelines.length} 条管线`;
}

/** 根据查看或编辑状态显示操作，写入期间锁定输入。 */
function updateControls() {
  const editing = mode !== 'view';
  const hasSelection = selectedId !== null;
  panel.classList.toggle('view-mode', !editing);
  panel.classList.toggle('editing', editing);
  select.disabled = editing || busy || !pipelines.length;
  document.querySelector('#new-pipeline').disabled = editing || busy;
  document.querySelector('#view-actions').hidden = editing;
  document.querySelector('#edit-pipeline').disabled = busy || !hasSelection;
  document.querySelector('#delete-pipeline').disabled = busy || !hasSelection;
  document.querySelector('#edit-fields').hidden = !editing;
  document.querySelector('#pipeline-meta').hidden = editing || !hasSelection;
  document.querySelector('#save-actions').hidden = !editing;
  document.querySelector('#add-point').hidden = !editing;
  document.querySelector('#prepend-point').hidden = !editing;
  document.querySelector('#analysis-controls').hidden = editing;
  document.querySelector('#results-section').hidden = editing;
  panelResizer.hidden = editing;
  document.querySelector('#editor-heading').textContent =
    mode === 'new' ? '新建管线' : mode === 'edit' ? '编辑管线' : '管线管理';

  // 坐标表在查看时只读，保存期间全部表单暂停操作。
  for (const input of form.querySelectorAll('input')) input.readOnly = !editing;
  for (const control of form.querySelectorAll('input, select, button')) control.disabled = busy;
  analyzeButton.disabled = editing || busy || !hasSelection || !threshold.validity.valid;
}

/** 显示管线属性和全部顶点，不改变数据库坐标。 */
function showPipeline(pipeline) {
  document.querySelector('#pipeline-name').value = pipeline?.name ?? '';
  document.querySelector('#pipeline-type-input').value = pipeline?.type ?? '供水';
  document.querySelector('#pipeline-radius-input').value = pipeline?.radiusM ?? 0.1;
  document.querySelector('#pipeline-type').textContent = `类型 ${pipeline?.type ?? '—'}`;
  document.querySelector('#pipeline-radius').textContent =
    `外半径 ${pipeline ? pipeline.radiusM.toFixed(3) + ' m' : '—'}`;
  activeVertex = 0;
  renderVertices(pipeline?.points ?? []);
}

/** 点击场景或切换下拉框时显示对应顶点。 */
function selectPipeline(id) {
  if (busy || mode !== 'view') return;
  const pipeline = pipelines.find((item) => item.id === id);
  if (!pipeline) return;
  selectedId = id;
  renderSelect();
  showPipeline(pipeline);
  clearAnalysis();
  showStatus();
  updateControls();
}

/** 生成坐标表；插点和删点后重排点号。 */
function renderVertices(points) {
  vertices.replaceChildren();
  points.forEach((point, index) => {
    const row = document.createElement('tr');
    row.classList.toggle('selected-vertex', index === activeVertex);
    const number = document.createElement('td');
    number.textContent = String(index + 1).padStart(2, '0');
    row.append(number);
    point.forEach((value, axis) => {
      const cell = document.createElement('td');
      const input = document.createElement('input');
      input.type = 'number';
      input.step = 'any';
      input.required = true;
      input.value = value;
      input.readOnly = mode === 'view';
      input.setAttribute('aria-label', `第${index + 1}点 ${'XYZ'[axis]}`);
      cell.append(input);
      row.append(cell);
    });
    const actions = document.createElement('td');
    actions.className = 'point-actions';
    for (const [label, title, action] of [
      ['＋', '在此点后插入顶点', () => insertPoint(index)],
      ['×', '删除此顶点', () => removePoint(index)],
    ]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.title = title;
      button.setAttribute('aria-label', `第${index + 1}点：${title}`);
      button.disabled = busy;
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        action();
      });
      actions.append(button);
    }
    row.append(actions);
    row.addEventListener('click', () => {
      activeVertex = index;
      for (const [position, item] of [...vertices.children].entries()) {
        item.classList.toggle('selected-vertex', position === index);
      }
      pipelineScene.showVertices(readPoints(), activeVertex);
    });
    vertices.append(row);
  });
  pipelineScene.showVertices(points, activeVertex);
}

/** 按当前表格顺序读取 XYZ 坐标。 */
function readPoints() {
  return [...vertices.querySelectorAll('tr')].map((row) =>
    [...row.querySelectorAll('input')].map((input) => input.valueAsNumber),
  );
}

/** 检查表单和相邻点，返回保存及预览共用的数据。 */
function readPipeline(report = false) {
  if (!form.checkValidity()) {
    if (report) form.reportValidity();
    return null;
  }
  const points = readPoints();
  if (points.length < 2 || !points.every((point) => point.every(Number.isFinite))) return null;
  if (
    points.some(
      (point, index) => index > 0 && point.every((v, axis) => v === points[index - 1][axis]),
    )
  ) {
    if (report) showStatus('相邻顶点不能重合', true);
    return null;
  }
  return {
    name: document.querySelector('#pipeline-name').value.trim(),
    type: document.querySelector('#pipeline-type-input').value,
    radiusM: document.querySelector('#pipeline-radius-input').valueAsNumber,
    points,
  };
}

/** 实时预览当前坐标和半径；冲突分析只针对保存后的管线。 */
function previewPipeline() {
  if (mode === 'view') return;
  showStatus();
  const pipeline = readPipeline();
  clearAnalysis();
  if (!pipeline) return;
  const preview = { ...pipeline, id: mode === 'new' ? -1 : selectedId };
  const visible =
    mode === 'new'
      ? [...pipelines, preview]
      : pipelines.map((item) => (item.id === selectedId ? preview : item));
  pipelineScene.loadPipelines(visible);
  pipelineScene.highlight(preview.id);
  pipelineScene.showVertices(preview.points, activeVertex);
}

/** 在指定点后插入顶点，index 为 -1 时添加到首部。 */
function insertPoint(index) {
  if (busy || mode === 'view') return;
  if (!form.reportValidity()) return;
  const points = readPoints();
  let inserted;
  if (index === -1) {
    const first = points[0];
    inserted = [first[0] - 1, first[1], first[2]];
  } else {
    const current = points[index];
    const next = points[index + 1];
    inserted = next
      ? current.map((value, axis) => (value + next[axis]) / 2)
      : [current[0] + 1, current[1], current[2]];
  }
  points.splice(index + 1, 0, inserted);
  activeVertex = index + 1;
  renderVertices(points);
  previewPipeline();
}

/** 删除一个顶点，保留构成折线所需的两个端点。 */
function removePoint(index) {
  if (busy || mode === 'view') return;
  const points = readPoints();
  if (points.length <= 2) {
    showStatus('至少保留两个顶点', true);
    return;
  }
  points.splice(index, 1);
  activeVertex = Math.min(index, points.length - 1);
  renderVertices(points);
  previewPipeline();
}

/** 进入新建或编辑状态，表格是当前草稿的数据来源。 */
function beginEdit(newPipeline = false) {
  if (busy || mode !== 'view') return;
  mode = newPipeline ? 'new' : 'edit';
  const pipeline = newPipeline
    ? {
        name: '规划管线',
        type: '供水',
        radiusM: 0.1,
        points: [
          [-5, -2, -1.5],
          [5, -2, -1.5],
        ],
      }
    : pipelines.find((item) => item.id === selectedId);
  renderSelect();
  showPipeline(pipeline);
  updateControls();
  previewPipeline();
}

/** 取消本次编辑，恢复数据库中已保存的管线。 */
function cancelEdit() {
  if (busy) return;
  mode = 'view';
  pipelineScene.loadPipelines(pipelines);
  renderSelect();
  showPipeline(pipelines.find((item) => item.id === selectedId));
  clearAnalysis();
  showStatus();
  updateControls();
}

/** 保存名称、类型、半径和所有顶点，成功后回到查看状态。 */
async function savePipeline(event) {
  event.preventDefault();
  if (busy || mode === 'view') return;
  const pipeline = readPipeline(true);
  if (!pipeline) return;
  busy = true;
  updateControls();
  showStatus('正在保存…');
  try {
    const saved = await requestJson(
      mode === 'new' ? '/api/pipelines' : `/api/pipelines/${selectedId}`,
      {
        method: mode === 'new' ? 'POST' : 'PUT',
        body: JSON.stringify(pipeline),
      },
    );
    // 使用服务端返回值更新列表，保存完成后才可进行冲突分析。
    const index = pipelines.findIndex((item) => item.id === saved.id);
    if (index < 0) pipelines.push(saved);
    else pipelines[index] = saved;
    selectedId = saved.id;
    mode = 'view';
    pipelineScene.loadPipelines(pipelines);
    renderSelect();
    showPipeline(saved);
    clearAnalysis();
    showStatus('已保存');
  } catch (error) {
    showStatus(error.message, true);
  } finally {
    busy = false;
    updateControls();
  }
}

/** 删除选中管线，完成后切换到列表中的第一条。 */
async function deletePipeline() {
  const pipeline = pipelines.find((item) => item.id === selectedId);
  if (busy || !pipeline || !confirm(`删除“${pipeline.name}”？`)) return;
  clearAnalysis();
  busy = true;
  updateControls();
  try {
    await requestJson(`/api/pipelines/${selectedId}`, { method: 'DELETE' });
    pipelines = pipelines.filter((item) => item.id !== selectedId);
    selectedId = pipelines[0]?.id ?? null;
    pipelineScene.loadPipelines(pipelines);
    renderSelect();
    showPipeline(pipelines[0]);
    clearAnalysis();
    showStatus('已删除');
  } catch (error) {
    showStatus(error.message, true);
  } finally {
    busy = false;
    updateControls();
  }
}

/** 取消旧查询，清空过期高亮和最近点连线。 */
function clearAnalysis() {
  analysisRequest?.abort();
  analysisRequest = null;
  clearances = null;
  activeTargetId = null;
  results.replaceChildren();
  summary.textContent = '未分析';
  analyzeButton.textContent = '冲突分析';
  resultMessage.hidden = true;
  pipelineScene.clearShortestLine();
  pipelineScene.highlight(mode === 'new' ? -1 : selectedId);
  updateControls();
}

/** 根据阈值显示冲突目标，结果沿用后端的净距排序。 */
function renderResults() {
  if (clearances === null) return;
  const conflictIds = new Set(
    clearances.filter((row) => row.clearanceM < threshold.valueAsNumber).map((row) => row.targetId),
  );
  pipelineScene.highlight(selectedId, conflictIds);
  summary.textContent = `${clearances.length} 条 · ${conflictIds.size} 处冲突`;
  results.replaceChildren();
  resultMessage.hidden = clearances.length > 0;
  resultMessage.textContent = '暂无其他管线';
  for (const row of clearances) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'result-row';
    button.classList.toggle('risk', conflictIds.has(row.targetId));
    button.classList.toggle('active', row.targetId === activeTargetId);
    button.setAttribute('aria-pressed', String(row.targetId === activeTargetId));
    const description = document.createElement('span');
    const name = document.createElement('strong');
    name.textContent = row.targetName;
    const distance = document.createElement('small');
    distance.textContent = `中心线 ${row.centerDistanceM.toFixed(3)} m`;
    description.append(name, distance);
    const value = document.createElement('strong');
    value.className = 'clearance-value';
    value.textContent = `${row.clearanceM.toFixed(3)} m`;
    button.append(description, value);
    button.addEventListener('click', () => {
      activeTargetId = row.targetId;
      pipelineScene.showShortestLine(row.shortestLine);
      renderResults();
    });
    results.append(button);
  }
}

/** 调用现有净距接口，只分析已经保存的管线。 */
async function analyze() {
  if (mode !== 'view' || busy || selectedId === null || !threshold.reportValidity()) return;
  showStatus();
  clearAnalysis();
  const request = new AbortController();
  analysisRequest = request;
  analyzeButton.disabled = true;
  analyzeButton.textContent = '分析中…';
  summary.textContent = '分析中';
  try {
    const rows = await requestJson(`/api/pipelines/${selectedId}/clearances`, {
      signal: request.signal,
    });
    if (analysisRequest !== request) return;
    clearances = rows;
    renderResults();
  } catch (error) {
    if (error.name === 'AbortError' || analysisRequest !== request) return;
    resultMessage.textContent = error.message;
    resultMessage.hidden = false;
    summary.textContent = '分析失败';
  } finally {
    if (analysisRequest === request) {
      analysisRequest = null;
      analyzeButton.textContent = '冲突分析';
      updateControls();
    }
  }
}

/** 初始化场景、管线列表和选中对象的坐标表。 */
async function initialize() {
  try {
    pipelineScene = createPipelineScene(document.querySelector('#scene'), selectPipeline);
    pipelines = await requestJson('/api/pipelines');
    pipelineScene.loadPipelines(pipelines);
    selectedId = pipelines[0]?.id ?? null;
    renderSelect();
    showPipeline(pipelines[0]);
    clearAnalysis();
    sceneMessage.hidden = true;
    updateControls();
  } catch (error) {
    sceneMessage.textContent = `加载失败：${error.message}`;
  }
}

// 表格输入仅更新三维预览，保存时统一提交。
form.addEventListener('input', previewPipeline);
form.addEventListener('change', previewPipeline);
form.addEventListener('submit', savePipeline);
select.addEventListener('change', () => selectPipeline(Number(select.value)));
document.querySelector('#new-pipeline').addEventListener('click', () => beginEdit(true));
document.querySelector('#edit-pipeline').addEventListener('click', () => beginEdit());
document.querySelector('#cancel-edit').addEventListener('click', cancelEdit);
document.querySelector('#delete-pipeline').addEventListener('click', deletePipeline);
document
  .querySelector('#add-point')
  .addEventListener('click', () => insertPoint(vertices.children.length - 1));
document.querySelector('#prepend-point').addEventListener('click', () => insertPoint(-1));
analyzeButton.addEventListener('click', analyze);
threshold.addEventListener('input', () => {
  updateControls();
  if (analysisRequest) analyzeButton.disabled = true;
  if (threshold.validity.valid) renderResults();
});
document.querySelector('#ground-mode').addEventListener('change', (event) => {
  pipelineScene?.setGroundMode(event.target.value);
});
document
  .querySelector('#reset-view')
  .addEventListener('click', () => pipelineScene?.resetView(false));
document.querySelector('#overview').addEventListener('click', () => pipelineScene?.resetView(true));

/** 调整信息区高度，为下方结果保留至少 180 像素。 */
function resizePanel(height) {
  const panelHeight = panel.clientHeight;
  const bounded = Math.max(300, Math.min(panelHeight - 180, height));
  const percentage = (bounded / panelHeight) * 100;
  panel.style.setProperty('--editor-height', `${percentage}%`);
  panelResizer.setAttribute('aria-valuenow', String(Math.round(percentage)));
}

// 使用指针捕获，鼠标拖出分隔线后仍可持续调整。
panelResizer.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return;
  event.preventDefault();
  panelResizer.setPointerCapture(event.pointerId);
  panelResizer.classList.add('dragging');
  document.body.classList.add('panel-dragging');
});
panelResizer.addEventListener('pointermove', (event) => {
  if (!panelResizer.hasPointerCapture(event.pointerId)) return;
  resizePanel(event.clientY - panel.getBoundingClientRect().top);
});
panelResizer.addEventListener('lostpointercapture', () => {
  panelResizer.classList.remove('dragging');
  document.body.classList.remove('panel-dragging');
});
panelResizer.addEventListener('dblclick', () => resizePanel(panel.clientHeight * 0.52));
panelResizer.addEventListener('keydown', (event) => {
  if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return;
  event.preventDefault();
  const currentHeight = document.querySelector('.selection-section').getBoundingClientRect().height;
  resizePanel(currentHeight + (event.key === 'ArrowUp' ? -24 : 24));
});

initialize();
