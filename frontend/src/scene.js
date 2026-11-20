import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createEnvironment } from './environment.js';

const typeColors = {
  供水: '#46b8eb',
  燃气: '#f2b84b',
  排水: '#7cc3a1',
  电力: '#bd9bed',
  通信: '#8cabbf',
};

/** 创建本地米制街区场景，管线与净距连线共用 XYZ 坐标。 */
export function createPipelineScene(container, onSelect) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#111e2b');
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 250);
  camera.up.set(0, 0, 1);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  container.append(renderer.domElement);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.maxPolarAngle = Math.PI * 0.54;
  controls.minDistance = 8;
  controls.maxDistance = 100;
  scene.add(new THREE.HemisphereLight('#deeeff', '#3b5461', 2.6));
  const sunlight = new THREE.DirectionalLight('#fff1d8', 3);
  sunlight.position.set(-10, -15, 30);
  scene.add(sunlight);
  const environment = createEnvironment(scene);
  const pipes = new Map();
  const lineGroup = new THREE.Group();
  scene.add(lineGroup);
  const vertexGroup = new THREE.Group();
  scene.add(vertexGroup);
  let groundMode = 'transparent';
  const labelLayer = document.createElement('div');
  labelLayer.className = 'vertex-label-layer';
  labelLayer.setAttribute('aria-hidden', 'true');
  container.append(labelLayer);
  let vertexLabels = [];
  const referenceAxes = createReferenceAxes();

  /** 沿基座边缘绘制坐标轴，并在交点标注基点坐标。 */
  function createReferenceAxes() {
    const layer = document.createElement('div');
    layer.className = 'reference-axis-layer';
    layer.setAttribute('aria-hidden', 'true');
    container.append(layer);
    const corner = new THREE.Vector3(-15.3, -14.3, -6.4);
    const labels = [];

    /** 标签位置使用世界坐标，不把边角当作零点。 */
    function addLabel(text, point, color, className, priority) {
      const label = document.createElement('span');
      label.className = `reference-axis-label ${className}`;
      label.style.color = color;
      label.textContent = text;
      layer.append(label);
      labels.push({ label, point, priority });
    }

    for (const axis of [
      {
        name: 'X',
        component: 'x',
        direction: new THREE.Vector3(1, 0, 0),
        length: 30.6,
        values: [-10, -5, 0, 5, 10],
        offset: new THREE.Vector3(0, -0.8, 0),
        tick: new THREE.Vector3(0, 0.35, 0),
        color: '#ff8980',
      },
      {
        name: 'Y',
        component: 'y',
        direction: new THREE.Vector3(0, 1, 0),
        length: 28.6,
        values: [-10, -5, 0, 5, 10],
        offset: new THREE.Vector3(-0.8, 0, 0),
        tick: new THREE.Vector3(0.35, 0, 0),
        color: '#8ee0a4',
      },
      {
        name: 'Z',
        component: 'z',
        direction: new THREE.Vector3(0, 0, 1),
        length: 7.2,
        values: [-6, -4, -2, 0],
        offset: new THREE.Vector3(-0.8, 0, 0),
        tick: new THREE.Vector3(0.35, 0, 0),
        color: '#8abfff',
      },
    ]) {
      const arrow = new THREE.ArrowHelper(
        axis.direction,
        corner,
        axis.length,
        axis.color,
        0.35,
        0.2,
      );
      for (const part of [arrow.line, arrow.cone]) {
        part.material.depthTest = false;
        part.material.toneMapped = false;
        part.renderOrder = 8;
      }
      scene.add(arrow);
      addLabel(
        axis.name,
        corner
          .clone()
          .addScaledVector(
            axis.direction,
            axis.name === 'X' ? axis.length - 1.8 : axis.length + (axis.name === 'Z' ? 1.6 : 0.5),
          ),
        axis.color,
        'axis-name',
        1,
      );

      // 刻度值直接取该点的对应坐标，Z=0 与地表平齐。
      const ticks = [];
      for (const value of axis.values) {
        const point = corner.clone();
        point[axis.component] = value;
        ticks.push(point, point.clone().add(axis.tick));
        addLabel(
          String(value),
          point.clone().add(axis.offset),
          axis.color,
          `axis-tick${value === 0 ? ' axis-zero' : ''}`,
          value === 0 ? 2 : 3,
        );
      }
      const lines = new THREE.LineSegments(
        new THREE.BufferGeometry().setFromPoints(ticks),
        new THREE.LineBasicMaterial({ color: axis.color, depthTest: false, toneMapped: false }),
      );
      lines.renderOrder = 8;
      scene.add(lines);
    }

    const basePoint = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 12, 8),
      new THREE.MeshBasicMaterial({ color: '#ffffff', depthTest: false }),
    );
    basePoint.position.copy(corner);
    basePoint.renderOrder = 8;
    scene.add(basePoint);
    addLabel('(-15.3, -14.3, -6.4)', corner.clone(), '#edf5fa', 'axis-base-point', 0);
    return labels.sort((first, second) => first.priority - second.priority);
  }

  /** 仅在相机、窗口或业务状态变化时重绘。 */
  function render() {
    renderer.render(scene, camera);
    const axisPositions = [];
    for (const { label, point } of referenceAxes) {
      const projected = point.clone().project(camera);
      const width = label.textContent.length * 8 + 12;
      const isBasePoint = label.classList.contains('axis-base-point');
      // 基点文字紧贴轴线交点的右下方，留出圆点的位置。
      const x = ((projected.x + 1) * container.clientWidth) / 2 + (isBasePoint ? width / 2 + 8 : 0);
      const y = ((1 - projected.y) * container.clientHeight) / 2 + (isBasePoint ? 24 : 0);
      const overlaps = axisPositions.some(
        (placed) =>
          Math.abs(placed.x - x) < (placed.width + width) / 2 + 3 && Math.abs(placed.y - y) < 23,
      );
      label.hidden = projected.z < -1 || projected.z > 1 || overlaps;
      if (!label.hidden) axisPositions.push({ x, y, width });
      label.style.left = `${x}px`;
      label.style.top = `${y}px`;
    }
    // 将顶点投影到画布位置，编号保持固定字号并随相机移动。
    const positions = [];
    for (const { element, point } of vertexLabels) {
      const projected = point.clone().project(camera);
      element.hidden = projected.z < -1 || projected.z > 1;
      const x = ((projected.x + 1) * container.clientWidth) / 2;
      const y = ((1 - projected.y) * container.clientHeight) / 2;
      let labelX = x;
      // 靠近的顶点错开编号，连线仍指向原来的顶点。
      while (
        positions.some(
          (position) => Math.abs(position.x - labelX) < 32 && Math.abs(position.y - y) < 32,
        )
      ) {
        labelX += 34;
      }
      if (!element.hidden) positions.push({ x: labelX, y });
      element.style.left = `${labelX}px`;
      element.style.top = `${y}px`;
      element.style.setProperty('--stem-length', `${Math.hypot(labelX - x, 12)}px`);
      element.style.setProperty('--stem-angle', `${Math.atan2(labelX - x, 12)}rad`);
    }
  }

  /** 返回街区总览，或拉近中心管网。 */
  function resetView(overview = true) {
    camera.position.set(overview ? 35 : 20, overview ? -43 : -26, overview ? 31 : 17);
    controls.target.set(0, 0, overview ? -1.4 : -1.8);
    controls.update();
    render();
  }

  /** 释放已移除的辅助线、端点及其材质。 */
  function disposeGroup(group) {
    for (const child of [...group.children]) {
      group.remove(child);
      child.geometry?.dispose();
      child.material?.dispose();
    }
  }

  /** 创建一段圆管，圆柱局部 Y 轴对准中心线方向。 */
  function segment(group, start, end, radius, material) {
    const direction = new THREE.Vector3().subVectors(end, start);
    if (direction.length() === 0) return;
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, direction.length(), 14),
      material,
    );
    mesh.position.copy(start).add(end).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    group.add(mesh);
  }

  /** 加载每条管线的分段圆管与转角，记录编号用于选取。 */
  function loadPipelines(data) {
    // 保存或取消后重建管网，先释放旧圆管和共用材质。
    for (const item of pipes.values()) {
      scene.remove(item.group);
      for (const mesh of item.group.children) mesh.geometry.dispose();
      item.material.dispose();
    }
    pipes.clear();
    for (const pipeline of data) {
      const group = new THREE.Group();
      const material = new THREE.MeshStandardMaterial({
        color: typeColors[pipeline.type],
        roughness: 0.35,
        metalness: 0.18,
      });
      const points = pipeline.points.map((point) => new THREE.Vector3(...point));
      for (let index = 1; index < points.length; index++) {
        segment(group, points[index - 1], points[index], pipeline.radiusM, material);
      }
      for (const point of points) {
        const joint = new THREE.Mesh(
          new THREE.SphereGeometry(pipeline.radiusM * 1.04, 12, 8),
          material,
        );
        joint.position.copy(point);
        group.add(joint);
      }
      group.traverse((mesh) => {
        mesh.userData.pipelineId = pipeline.id;
      });
      scene.add(group);
      pipes.set(pipeline.id, { group, material, pipeline });
    }
    render();
  }

  /** 显示顶点及其顺序编号，当前坐标行对应黄色标记。 */
  function showVertices(points, activeIndex = 0) {
    disposeGroup(vertexGroup);
    labelLayer.replaceChildren();
    vertexLabels = [];
    points.forEach((point, index) => {
      if (!point.every(Number.isFinite)) return;
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 12, 8),
        new THREE.MeshBasicMaterial({
          color: index === activeIndex ? '#f6c96d' : '#a6eee1',
          depthTest: false,
        }),
      );
      marker.position.set(...point);
      marker.renderOrder = 6;
      vertexGroup.add(marker);
      const label = document.createElement('span');
      label.className = 'vertex-number';
      label.classList.toggle('active', index === activeIndex);
      label.textContent = String(index + 1);
      labelLayer.append(label);
      vertexLabels.push({ element: label, point: marker.position.clone() });
    });
    render();
  }

  /** 以白色标记选中管线，以红色标记低于阈值的目标。 */
  function highlight(id, riskIds = new Set()) {
    for (const [key, item] of pipes) {
      const color =
        key === id ? '#f4f8ff' : riskIds.has(key) ? '#ff6b64' : typeColors[item.pipeline.type];
      item.material.color.set(color);
      item.material.emissive.set(color);
      item.material.emissiveIntensity = key === id || riskIds.has(key) ? 0.32 : 0.05;
    }
    render();
  }

  /** 清除上一条最近点连线。 */
  function clearShortestLine() {
    disposeGroup(lineGroup);
    render();
  }

  /** 显示后端返回的最近点连线与两端圆点。 */
  function showShortestLine(coordinates) {
    disposeGroup(lineGroup);
    const points = coordinates.map((point) => new THREE.Vector3(...point));
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineDashedMaterial({
        color: '#ffffff',
        dashSize: 0.09,
        gapSize: 0.045,
        depthTest: false,
      }),
    );
    line.computeLineDistances();
    line.renderOrder = 5;
    lineGroup.add(line);
    for (const point of points) {
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.075, 12, 8),
        new THREE.MeshBasicMaterial({ color: '#ffffff', depthTest: false }),
      );
      marker.position.copy(point);
      marker.renderOrder = 6;
      lineGroup.add(marker);
    }
    render();
  }

  // 点击与旋转共用画布，只对未拖动的左键操作进行选取。
  let pointerStart = null;
  const raycaster = new THREE.Raycaster();
  renderer.domElement.addEventListener('pointerdown', (event) => {
    pointerStart = event.button === 0 ? { x: event.clientX, y: event.clientY } : null;
  });
  renderer.domElement.addEventListener('pointerup', (event) => {
    if (
      !pointerStart ||
      Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 5
    )
      return;
    const rect = renderer.domElement.getBoundingClientRect();
    raycaster.setFromCamera(
      new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        (-(event.clientY - rect.top) / rect.height) * 2 + 1,
      ),
      camera,
    );
    const hit = raycaster
      .intersectObjects(
        [...pipes.values()].map((item) => item.group),
        true,
      )
      .find((intersection) => intersection.object.isMesh);
    if (!hit) return;
    // 透明地面不挡选取，建筑等实体仍按实际遮挡关系处理。
    const surfaceHit =
      groundMode === 'hidden'
        ? null
        : raycaster
            .intersectObject(environment.surface, true)
            .find((hit) => hit.object.material.depthWrite);
    if (!surfaceHit || surfaceHit.distance > hit.distance) onSelect(hit.object.userData.pipelineId);
  });

  controls.addEventListener('change', render);
  new ResizeObserver(() => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
    render();
  }).observe(container);
  resetView();
  return {
    loadPipelines,
    showVertices,
    highlight,
    clearShortestLine,
    showShortestLine,
    resetView,
    /** 切换实体、透明和隐藏地表。 */
    setGroundMode(mode) {
      groundMode = mode;
      environment.setMode(mode);
      render();
    },
  };
}
