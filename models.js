function createCube() {
  const positions = new Float32Array([
    -1, -1,  1,   1, -1,  1,   1,  1,  1,  -1,  1,  1,   // front
     1, -1, -1,  -1, -1, -1,  -1,  1, -1,   1,  1, -1,   // back
    -1,  1,  1,   1,  1,  1,   1,  1, -1,  -1,  1, -1,   // top
    -1, -1, -1,   1, -1, -1,   1, -1,  1,  -1, -1,  1,   // bottom
     1, -1,  1,   1, -1, -1,   1,  1, -1,   1,  1,  1,   // right
    -1, -1, -1,  -1, -1,  1,  -1,  1,  1,  -1,  1, -1    // left
  ]);
  const faceNormals = [[0, 0, 1], [0, 0, -1], [0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0]];
  const normals = new Float32Array(faceNormals.flatMap(n => [...n, ...n, ...n, ...n]));

  const indices = new Uint16Array([
     0,  1,  2,   0,  2,  3,   // front
     4,  5,  6,   4,  6,  7,   // back
     8,  9, 10,   8, 10, 11,   // top
    12, 13, 14,  12, 14, 15,   // bottom
    16, 17, 18,  16, 18, 19,   // right
    20, 21, 22,  20, 22, 23    // left
  ]);

  const colors = new Float32Array(24 * 3).fill(1.0);


  const texCoords = new Float32Array([
    // Front
    0.0, 0.0,   1.0, 0.0,   1.0, 1.0,   0.0, 1.0,
    // Back
    0.0, 0.0,   1.0, 0.0,   1.0, 1.0,   0.0, 1.0,
    // Top
    0.05, 0.05,   0.05, 0.05,   0.05, 0.05,   0.05, 0.05,
    // Bottom
    0.0, 0.0,   1.0, 0.0,   1.0, 1.0,   0.0, 1.0,
    // Right
    0.0, 0.0,   1.0, 0.0,   1.0, 1.0,   0.0, 1.0,
    // Left
    0.0, 0.0,   1.0, 0.0,   1.0, 1.0,   0.0, 1.0
  ]);


  return { positions, colors, normals, texCoords, indices };
}



function createPrism() {
  const vertices = [
    [0.0,  1.0,  1.0],
    [-1.0, -1.0,  1.0],
    [1.0, -1.0,  1.0],
    [0.0,  1.0, -1.0],
    [-1.0, -1.0, -1.0],
    [1.0, -1.0, -1.0]
  ];

  const faces = [
    [0, 1, 2],
    [3, 5, 4],
    [1, 4, 5], [1, 5, 2],
    [0, 3, 4], [0, 4, 1],
    [0, 2, 5], [0, 5, 3]
  ];

  const positions = [];
  const normals = [];
  const indices = [];

  for (const face of faces) {
    const a = vertices[face[0]];
    const b = vertices[face[1]];
    const c = vertices[face[2]];

    // Two edges of the triangle
    const u = [
      b[0] - a[0],
      b[1] - a[1],
      b[2] - a[2]
    ];

    const v = [
      c[0] - a[0],
      c[1] - a[1],
      c[2] - a[2]
    ];

    // Cross product gives the face normal
    const nx = u[1] * v[2] - u[2] * v[1];
    const ny = u[2] * v[0] - u[0] * v[2];
    const nz = u[0] * v[1] - u[1] * v[0];

    const length = Math.hypot(nx, ny, nz);

    const normal = [
      nx / length,
      ny / length,
      nz / length
    ];

    // Each triangle gets its own vertices and normals
    for (const vertex of [a, b, c]) {
      positions.push(...vertex);
      normals.push(...normal);
      indices.push(indices.length);
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint16Array(indices)
  };
}


function createPyramid() {
  const positions = new Float32Array([
     0.0,  1.0,  0.0,  // Top point
    -1.0, -1.0,  1.0,  // Front-left
     1.0, -1.0,  1.0,  // Front-right
     1.0, -1.0, -1.0,  // Back-right
    -1.0, -1.0, -1.0   // Back-left
  ]);

  const colors = new Float32Array([
    1.0, 1.0, 0.0,
    1.0, 0.0, 0.0,
    0.0, 1.0, 0.0,
    0.0, 0.0, 1.0,
    1.0, 0.0, 1.0
  ]);

  const indices = new Uint16Array([
    // Front
    0, 1, 2,
    // Right
    0, 2, 3,
    // Back
    0, 3, 4,
    // Left
    0, 4, 1,
    // Base (square = 2 triangles)
    1, 3, 2,
    1, 4, 3
  ]);

  return { positions, colors, indices };
}

function createCylinder(segments) {
  const pos = [], nrm = [], idx = [];

  // Side
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2, x = Math.cos(a), z = Math.sin(a);
    pos.push(x, -1, z, x, 1, z);
    nrm.push(x, 0, z, x, 0, z);
  }
  for (let i = 0; i < segments; i++) {
    const b = i * 2;
    idx.push(b, b + 1, b + 3, b, b + 3, b + 2);
  }

  // Caps
  for (const y of [-1, 1]) {
    const center = pos.length / 3;
    pos.push(0, y, 0);
    nrm.push(0, y, 0);
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      pos.push(Math.cos(a), y, Math.sin(a));
      nrm.push(0, y, 0);
    }
    for (let i = 1; i <= segments; i++) {
      if (y > 0) idx.push(center, center + i + 1, center + i);
      else idx.push(center, center + i, center + i + 1);
    }
  }

  return { positions: new Float32Array(pos), normals: new Float32Array(nrm), indices: new Uint16Array(idx) };
}

