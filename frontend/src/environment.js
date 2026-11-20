import * as THREE from 'three';

/** 创建街区地表、建筑和地下基座，地面统一位于 Z=0。 */
export function createEnvironment(scene) {
  const surface = new THREE.Group();
  scene.add(surface);
  const materials = new Map();

  /** 复用同色材质，减少重复分配。 */
  function material(color, roughness = 0.8) {
    if (!materials.has(color)) {
      materials.set(color, new THREE.MeshStandardMaterial({ color, roughness }));
    }
    return materials.get(color);
  }

  /** 放置一个以 Z 为高度的长方体。 */
  function box(parent, x, y, z, width, depth, height, color) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, depth, height), material(color));
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }

  // 基座保持可见，帮助辨认管线所在深度。
  const base = box(scene, 0, 0, -6.6, 31, 29, 0.45, '#203b4e');
  // 半透明基座保留地下空间的层次。
  base.material = new THREE.MeshStandardMaterial({
    color: '#203b4e',
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  });
  const grid = new THREE.GridHelper(30, 30, '#436477', '#2e4d60');
  grid.rotation.x = Math.PI / 2;
  grid.position.z = -6.36;
  scene.add(grid);
  const bounds = new THREE.EdgesGeometry(new THREE.BoxGeometry(30.6, 28.6, 6.4));
  const outline = new THREE.LineSegments(bounds, new THREE.LineBasicMaterial({ color: '#365568' }));
  outline.position.z = -3.2;
  scene.add(outline);

  // 十字道路居中，两侧布置人行道和四个地块。
  box(surface, 0, 0, -0.12, 30, 28, 0.24, '#91a19b');
  box(surface, 0, 0, 0.025, 7.2, 28, 0.05, '#344754');
  box(surface, 0, 0, 0.03, 30, 6, 0.06, '#344754');
  for (const side of [-1, 1]) {
    box(surface, side * 3.8, 0, 0.08, 0.4, 28, 0.16, '#b4c0bd');
    box(surface, 0, side * 3.2, 0.08, 30, 0.4, 0.16, '#b4c0bd');
    for (let step = -13; step <= 13; step += 2) {
      if (Math.abs(step) > 4) {
        box(surface, side * 1.7, step, 0.067, 0.06, 0.8, 0.015, '#b7c6c8');
        box(surface, step, side * 1.4, 0.07, 0.8, 0.06, 0.015, '#b7c6c8');
      }
    }
  }
  for (const side of [-1, 1]) {
    box(surface, 0, side * 8.8, 0.07, 0.07, 9.5, 0.015, '#d6bc79');
    box(surface, side * 9.7, 0, 0.075, 10.5, 0.07, 0.015, '#d6bc79');
    for (let stripe = -2.6; stripe <= 2.7; stripe += 0.65) {
      box(surface, stripe, side * 3.9, 0.08, 0.35, 1, 0.02, '#dce4df');
      box(surface, side * 4.6, stripe * 0.8, 0.08, 1, 0.28, 0.02, '#dce4df');
    }
  }

  /** 布置树干、树冠和树池。 */
  function tree(x, y, height = 1.5) {
    box(surface, x, y, 0.18, 0.65, 0.65, 0.12, '#647d73');
    box(surface, x, y, 0.6, 0.09, 0.09, 0.9, '#7e7561');
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.48, 1), material('#5e9b84'));
    crown.scale.set(1, 1, height / 0.8);
    crown.position.set(x, y, height * 0.65 + 0.65);
    surface.add(crown);
  }

  /** 以实例网格排列立面窗户，避免每扇窗单独绘制。 */
  function windows(x, y, width, depth, height) {
    const positions = [];
    for (let z = 0.9; z < height - 0.3; z += 0.58) {
      for (let dx = -width / 2 + 0.35; dx < width / 2 - 0.1; dx += 0.5) {
        positions.push([x + dx, y - depth / 2 - 0.02, z]);
        positions.push([x + dx, y + depth / 2 + 0.02, z]);
      }
    }
    const mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.28, 0.035, 0.3),
      material('#81b6c6'),
      positions.length,
    );
    const matrix = new THREE.Matrix4();
    positions.forEach((point, index) => mesh.setMatrixAt(index, matrix.makeTranslation(...point)));
    surface.add(mesh);
    // 侧立面采用连续窗带，与正面的竖向窗格形成层次。
    for (let z = 0.9; z < height - 0.3; z += 0.58) {
      for (const side of [-1, 1]) {
        box(surface, x + side * (width / 2 + 0.02), y, z, 0.03, depth - 0.5, 0.25, '#648f9f');
      }
    }
  }

  /** 创建带裙楼、窗格、屋顶机房的建筑。 */
  function building(x, y, width, depth, height) {
    box(surface, x, y, 0.24, width + 1.1, depth + 1.1, 0.28, '#b7c8c2');
    box(surface, x, y, 0.55, width + 0.45, depth + 0.45, 0.45, '#849e9f');
    box(surface, x, y, height / 2 + 0.35, width, depth, height, '#aac0c1');
    windows(x, y, width, depth, height);
    box(surface, x, y, height + 0.4, width + 0.18, depth + 0.18, 0.15, '#d1ddd8');
    box(surface, x, y, height + 0.53, width - 0.3, depth - 0.3, 0.12, '#718d95');
    box(surface, x + 0.3, y, height + 0.85, width * 0.35, depth * 0.4, 0.55, '#becdc8');
  }

  // 高层靠后，前景使用低层和公园，保留管网观察空间。
  for (const [x, y] of [
    [-9, -8.5],
    [9, -8.5],
    [-9, 8.5],
    [9, 8.5],
  ]) {
    box(surface, x, y, 0.08, 9.4, 9.2, 0.12, '#7d9f87');
    box(surface, x, y, 0.16, 0.65, 9.2, 0.05, '#bdc7b8');
    box(surface, x, y, 0.16, 9.4, 0.6, 0.05, '#bdc7b8');
    for (const dx of [-3.7, 3.7]) {
      for (const dy of [-3.4, 0, 3.4]) tree(x + dx, y + dy, 1.1 + (dy + 3.4) * 0.04);
    }
  }
  building(-9, 8.5, 3.8, 3.7, 8.3);
  building(8.7, 9, 4, 3.5, 10.4);
  building(11.4, 5.5, 2.2, 2.1, 5.2);
  building(-9.4, -9, 4.3, 3.4, 3.1);
  building(10, -9.4, 3.6, 3.1, 4.1);

  // 前景公园布置环形步道、树池和长椅。
  const park = new THREE.Mesh(new THREE.RingGeometry(1.35, 1.85, 40), material('#c1cbb9'));
  park.position.set(-7.4, -5.7, 0.2);
  surface.add(park);
  for (const [x, y] of [
    [-5.6, -8.6],
    [-11, -5],
    [6, -6],
    [12, -7],
  ]) {
    box(surface, x, y, 0.4, 1.2, 0.35, 0.14, '#b29a72');
    box(surface, x, y + 0.15, 0.65, 1.2, 0.1, 0.35, '#b29a72');
  }
  for (const [x, y] of [
    [-6, 3.8],
    [6, -3.8],
    [-3.9, -7],
    [3.9, 7],
  ]) {
    box(surface, x, y, 1.5, 0.06, 0.06, 2.8, '#607d86');
    box(surface, x + 0.25, y, 2.92, 0.65, 0.18, 0.1, '#d3d9bc');
  }

  /** 实体模式遮挡地下对象；透明模式保留街区轮廓；隐藏模式只显示管网。 */
  function setMode(mode) {
    surface.visible = mode !== 'hidden';
    const groundColors = new Set(['#91a19b', '#344754', '#b4c0bd', '#7d9f87', '#bdc7b8']);
    for (const [color, item] of materials) {
      const transparent = mode === 'transparent' && groundColors.has(color);
      item.transparent = transparent;
      item.opacity = transparent ? 0.18 : 1;
      item.depthWrite = !transparent;
      item.needsUpdate = true;
    }
  }
  // 初次展示保留完整建筑，地表可随时切换透明观察。
  setMode('transparent');
  return { surface, setMode };
}
