const VERTEX_SHADER = `#version 300 es
in vec3 aPosition;
in vec3 aNormal;
in vec2 aTexCoord;

uniform mat4 uModelView;
uniform mat4 uProjection;
uniform mat3 uNormalMatrix;

out vec3 vPosition;
out vec3 vNormal;
out vec2 vTexCoord;

void main() {
  vec4 p = uModelView * vec4(aPosition, 1.0);
  vPosition = p.xyz;
  // vNormal = mat3(uModelView) * aNormal;
  vNormal = normalize(uNormalMatrix * aNormal);
  vTexCoord = aTexCoord;
  gl_Position = uProjection * p;
}
`;

const FRAGMENT_SHADER = `#version 300 es
precision mediump float;

in vec3 vPosition;
in vec3 vNormal;
in vec2 vTexCoord;

uniform vec3 uLightPos0;
uniform vec3 uLightColor0;

uniform vec3 uLightPos1;
uniform vec3 uLightColor1;
uniform bool uEnableLight1;

uniform vec3 uColor;
uniform vec3 uKa;
uniform vec3 uKd;
uniform vec3 uKs;
uniform float uShininess;
uniform sampler2D uSampler;
uniform bool uUseFlatShading;
uniform bool uUseTexture;

out vec4 fragColor;

void main() {
  // Compute surface normal (Flat vs Smooth)
  vec3 N; 
  if (uUseFlatShading) {
    N = normalize(cross(dFdx(vPosition), dFdy(vPosition)));
  } else {
    N = normalize(vNormal);
  }

  //View vector pointing to eye
  vec3 V = normalize(-vPosition);

  // Single baseColor definition
  vec3 baseColor = uUseTexture ? (uColor * texture(uSampler, vTexCoord).rgb) : uColor;
  
  // Ambient term
  vec3 ambient = uKa * baseColor;

  // Key Light (Light 0)
  vec3 L0 = normalize(uLightPos0 - vPosition);
  vec3 R0 = reflect(-L0, N);
  float diff0 = max(dot(N, L0), 0.0);
  float spec0 = (diff0 > 0.0 && uShininess > 0.0) ? pow(max(dot(V, R0), 0.0), uShininess) : 0.0;  
  vec3 light0 = (uKd * baseColor * diff0 + uKs * spec0) * uLightColor0;

  // Secondary Light from cabin
  vec3 light1 = vec3(0.0);
  if (uEnableLight1) {
    vec3 L1 = normalize(uLightPos1 - vPosition);
    vec3 R1 = reflect(-L1, N);
    float diff1 = max(dot(N, L1), 0.0);
    float spec1 = (diff1 > 0.0 && uShininess > 0.0) ? pow(max(dot(V, R1), 0.0), uShininess) : 0.0;
    light1 = (uKd * baseColor * diff1 + uKs * spec1) * uLightColor1;
  }

  // Final Blended Color
  fragColor = vec4(ambient + light0 + light1, 1.0);
}
`;

// WebGL setup
const canvas = document.getElementById("glcanvas");
const gl = canvas.getContext("webgl2");

function compile(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
  return shader;
}

// Fixed attribute slots, so the meshes stay valid when the shaders are recompiled
const ATTRIBUTES = { aPosition: 0, aNormal: 1, aTexCoord: 2};

function createProgram(vsSource, fsSource) {
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, vsSource));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fsSource));
  for (const name in ATTRIBUTES) gl.bindAttribLocation(prog, ATTRIBUTES[name], name);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  return prog;
}

// Shader editors
const vertEditor = document.getElementById("vertEditor");
const fragEditor = document.getElementById("fragEditor");
const shaderError = document.getElementById("shaderError");
vertEditor.value = VERTEX_SHADER;
fragEditor.value = FRAGMENT_SHADER;

let program, uModelView, uProjection, uLightPos, uColor;
let uSamplerLoc;
var catTexture;
var texCoordLoc = -1;
let uUseTextureLoc;

function updateProgram() {
  try {
    const prog = createProgram(vertEditor.value, fragEditor.value);
    gl.deleteProgram(program);
    program = prog;
    gl.useProgram(program);

    texCoordLoc = gl.getAttribLocation(program, "aTexCoord")
    uModelView = gl.getUniformLocation(program, "uModelView");
    uProjection = gl.getUniformLocation(program, "uProjection");
    uLightPos = gl.getUniformLocation(program, "uLightPos");
    uColor = gl.getUniformLocation(program, "uColor");
    uSamplerLoc = gl.getUniformLocation(program, "uSampler");
    uUseTextureLoc = gl.getUniformLocation(program, "uUseTexture");

    shaderError.textContent = "";
    return true;
  } catch (e) {
    shaderError.textContent = e.message.replace(/\0/g, "");
    return false;
  }
}
updateProgram();

vertEditor.addEventListener("input", () => updateProgram());
fragEditor.addEventListener("input", () => updateProgram());

function bindAttribute(name, data, size = 3) {
  if (!data) return;
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  gl.vertexAttribPointer(ATTRIBUTES[name], size, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(ATTRIBUTES[name]);
}

function createMesh({ positions, normals, texCoords ,indices }) {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  bindAttribute("aPosition", positions);
  bindAttribute("aNormal", normals);
  bindAttribute("aTexCoord", texCoords, 2);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
  return { vao, count: indices.length };
}

const bodyMesh = createMesh(createCube());
const cabinMesh = createMesh(createCube());
const turntableMesh = createMesh(createCylinder(24));
const boomMesh = createMesh(createCylinder(32));
const armMesh = createMesh(createCylinder(32));
const bucketMesh = createMesh(createPrism());

gl.enable(gl.DEPTH_TEST);
gl.clearColor(0.12, 0.12, 0.14, 1.0);
const projection = perspective(Math.PI / 4, canvas.width / canvas.height, 0.1, 100);
const lightWorld = [3, 4, 5];

// nteractive controls
let dragRotX = 0, dragRotY = -0.5;      // mouse drag
let camX = 0, camY = 0, camZ = -7;      // arrow keys, w, s
let sliderAngle = 0;                    // degrees
let spinning = false, spinAngle = 0;    // Start/Stop button

let mouseDown = false, lastX, lastY;
canvas.addEventListener("mousedown", e => { mouseDown = true; lastX = e.clientX; lastY = e.clientY; });
window.addEventListener("mouseup", () => mouseDown = false);
window.addEventListener("mousemove", e => {
  if (!mouseDown) return;
  dragRotY += (e.clientX - lastX) * 0.01;
  dragRotX += (e.clientY - lastY) * 0.01;
  lastX = e.clientX; lastY = e.clientY;
});

document.addEventListener("keydown", e => {
  if (e.target === vertEditor || e.target === fragEditor) return;  // let the editors use the keys
  const step = 0.2;
  switch (e.key) {
    case "ArrowUp": camY -= step; break;
    case "ArrowDown": camY += step; break;
    case "ArrowLeft": camX += step; break;
    case "ArrowRight": camX -= step; break;
    case "w": camZ += step; break;
    case "s": camZ -= step; break;
    default: return;
  }
  e.preventDefault();  // keep the arrow keys from scrolling the page
});

const axisSelect = document.getElementById("axisSelect");
document.getElementById("slider").addEventListener("input", e => {
  sliderAngle = Number(e.target.value);
  document.getElementById("sliderValue").textContent = sliderAngle;
});
document.getElementById("spinButton").addEventListener("click", () => spinning = !spinning);


function createNode(mesh, color, shape, material = {}) {
  return { 
    mesh,
    color, 
    shape, 
    joint: null, 
    children: [],
    material: {
      ka: material.ka || [0.2, 0.2, 0.2],
      kd: material.kd || [0.8, 0.8, 0.8],
      ks: material.ks || [0.0, 0.0, 0.0],
      shininess: material.shininess !== undefined ? material.shininess : 0.0,
      flat: !!material.flat,
      useTexture: !!material.useTexture
    }
  };
}

// Body root(Diffuse)
const body = createNode(
  bodyMesh,
  [0.35, 0.35, 0.38],
  multiply(translate(0, -1.0, 0), scale(1.4, 0.5, 0.5)),
  { ka: [0.3, 0.3, 0.3], kd: [0.8, 0.8, 0.8], ks: [0.0, 0.0, 0.0], shininess: 0.0, useTexture: true }
);

// Slew Bearing(High Specular Reflection)
const cabinJoint = createNode(
  turntableMesh,
  [0.85, 0.85, 0.9],
  multiply(translate(0, 0.25, 0),scale(0.35, 0.1, 0.35)),
  { ka: [0.1, 0.1, 0.1], kd: [0.2, 0.2, 0.2], ks: [0.95, 0.95, 0.95], shininess: 64.0 }
);

// Operator(Combined Diffuse + Specular)
const cabin = createNode(
  cabinMesh,
  [0.95, 0.75, 0.05],
  multiply(translate(0, 0.6, 0), scale(0.5, 0.3, 0.5)),
  { ka: [0.2, 0.2, 0.2], kd: [0.75, 0.75, 0.75], ks: [0.4, 0.4, 0.4], shininess: 24.0 }
);

// Main Boom(Combined Diffuse + Specular)
const upperArm = createNode(
  boomMesh,
  [0.95, 0.75, 0.05],
  multiply(translate(0, 0.8, 0), scale(0.2, 0.7, 0.2)),
  { ka: [0.2, 0.2, 0.2], kd: [0.8, 0.8, 0.8], ks: [0.5, 0.5, 0.5], shininess: 32.0 }
);

// Forearm(Combined Diffuse + Specular)
const lowerArm = createNode(
  armMesh,
  [0.95, 0.75, 0.05],
  multiply(translate(0, 0.5, 0), scale(0.2, 0.5, 0.2)),
  { ka: [0.2, 0.2, 0.2], kd: [0.8, 0.8, 0.8], ks: [0.5, 0.5, 0.5], shininess: 32.0 }
);

// Grapple (Flat-Shaded Diffuse)
const bucket = createNode(
  bucketMesh,
  [0.28, 0.28, 0.3],
  multiply(
    translate(0.0, 0, 0.0),
    multiply(
      rotateX(Math.PI),
      scale(0.45, 0.45, 0.45)
    )
  ),
  {
    ka: [0.25, 0.25, 0.25],
    kd: [0.75, 0.75, 0.75],
    ks: [0.2, 0.2, 0.2],
    shininess: 12.0,
    flat: true
  }
);

body.children.push(cabinJoint);
cabinJoint.children.push(cabin);
cabin.children.push(upperArm);
upperArm.children.push(lowerArm);  
lowerArm.children.push(bucket);


function getNormalMatrix(mv) {
  // Upper-left 3x3, stored in column-major order
  const a00 = mv[0], a01 = mv[4], a02 = mv[8];
  const a10 = mv[1], a11 = mv[5], a12 = mv[9];
  const a20 = mv[2], a21 = mv[6], a22 = mv[10];

  const c00 = a11 * a22 - a12 * a21;
  const c01 = a12 * a20 - a10 * a22;
  const c02 = a10 * a21 - a11 * a20;

  const det = a00 * c00 + a01 * c01 + a02 * c02;

  if (Math.abs(det) < 1e-8) {
    throw new Error("Normal matrix is not invertible");
  }

  const invDet = 1.0 / det;

  // Inverse transpose, flattened column-major
  return new Float32Array([
    c00 * invDet,
    (a02 * a21 - a01 * a22) * invDet,
    (a01 * a12 - a02 * a11) * invDet,

    c01 * invDet,
    (a00 * a22 - a02 * a20) * invDet,
    (a02 * a10 - a00 * a12) * invDet,

    c02 * invDet,
    (a01 * a20 - a00 * a21) * invDet,
    (a00 * a11 - a01 * a10) * invDet
  ]);
}


function drawNode(node, frame, texture, forceFlatShading) {
  const modelViewMatrix = multiply(frame, node.shape);
  const normalMatrix = getNormalMatrix(modelViewMatrix);

  gl.uniformMatrix4fv(uModelView, false, modelViewMatrix);
  gl.uniformMatrix3fv(uNormalMatrixLoc, false, normalMatrix);
  gl.uniform3fv(uColor, node.color);

  // Material property bindings
  gl.uniform3fv(uKaLoc, node.material.ka);
  gl.uniform3fv(uKdLoc, node.material.kd);
  gl.uniform3fv(uKsLoc, node.material.ks);


  let activeShininess = node.material.shininess;

  if (node === cabin) {
    activeShininess = Number(cabinShininessSlider.value);
  }

  if (node === upperArm) {
    activeShininess = Number(boomShininessSlider.value);
  }
  gl.uniform1f(uShininessLoc, activeShininess);

  const isFlat = forceFlatShading || node.material.flat;
  gl.uniform1i(uUseFlatShadingLoc, isFlat ? 1 : 0);

  // Texture binding
  if (node.material.useTexture && texture) {
    gl.uniform1i(uUseTextureLoc, 1);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(uSamplerLoc, 0);
  } else {
    gl.uniform1i(uUseTextureLoc, 0);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  gl.bindVertexArray(node.mesh.vao);
  gl.drawElements(gl.TRIANGLES, node.mesh.count, gl.UNSIGNED_SHORT, 0);
}

//Data structure
function drawTree(root, rootFrame, texture, forceFlatShading) {
  const stack = [[root, rootFrame]];
  while (stack.length > 0) {
    const [node, parentFrame] = stack.pop();
    const frame = multiply(parentFrame, node.joint);
    drawNode(node, frame, texture, forceFlatShading);
    for (const child of node.children) stack.push([child, frame]);
  }
}

function createCatTexture(gl) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext("2d");

  // Base Plate Metallic Silver
  ctx.fillStyle = "#c8cbd0";
  ctx.fillRect(0, 0, 512, 512);

  //Steel Plate Rim DARK GREY
  ctx.fillStyle = "#8a8f98";
  ctx.fillRect(0, 0, 512, 28);
  ctx.fillRect(0, 484, 512, 28);
  ctx.fillRect(0, 0, 28, 512);
  ctx.fillRect(484, 0, 28, 512);

  // Inner Highlight Rim 
  ctx.strokeStyle = "#e8eaed";
  ctx.lineWidth = 6;
  ctx.strokeRect(32, 32, 448, 448);

  //Central Recessed Emblem Badge DARK CHARCOAL GRAY
  ctx.fillStyle = "#1e2024";
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(70, 110, 372, 290, 24) : ctx.rect(70, 110, 372, 290);
  ctx.fill();

  // Outer gold trim around the badge
  ctx.strokeStyle = "#f5b700";
  ctx.lineWidth = 8;
  ctx.stroke();

  // Triangle YELLOW CAT Logo
  ctx.fillStyle = "#f5b700";
  ctx.beginPath();
  ctx.moveTo(110, 355);
  ctx.lineTo(250, 355);
  ctx.lineTo(180, 225);
  ctx.closePath();
  ctx.fill();

  // Bold "CAT" Lettering 
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 130px Arial Black, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("CAT", 280, 260);

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
  gl.generateMipmap(gl.TEXTURE_2D);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindTexture(gl.TEXTURE_2D, null);

  return tex;
}

catTexture = createCatTexture(gl);

// Uniform Locations
let uNormalMatrixLoc, uLightPos0Loc, uLightColor0Loc, uLightPos1Loc, uLightColor1Loc, uEnableLight1Loc;
let uKaLoc, uKdLoc, uKsLoc, uShininessLoc, uUseFlatShadingLoc;

function cacheUniformLocations() {
  uModelView = gl.getUniformLocation(program, "uModelView");
  uProjection = gl.getUniformLocation(program, "uProjection");
  uNormalMatrixLoc = gl.getUniformLocation(program, "uNormalMatrix");

  uLightPos0Loc = gl.getUniformLocation(program, "uLightPos0");
  uLightColor0Loc = gl.getUniformLocation(program, "uLightColor0");
  uLightPos1Loc = gl.getUniformLocation(program, "uLightPos1");
  uLightColor1Loc = gl.getUniformLocation(program, "uLightColor1");
  uEnableLight1Loc = gl.getUniformLocation(program, "uEnableLight1");

  uColor = gl.getUniformLocation(program, "uColor");
  uKaLoc = gl.getUniformLocation(program, "uKa");
  uKdLoc = gl.getUniformLocation(program, "uKd");
  uKsLoc = gl.getUniformLocation(program, "uKs");
  uShininessLoc = gl.getUniformLocation(program, "uShininess");
  uUseFlatShadingLoc = gl.getUniformLocation(program, "uUseFlatShading");

  uSamplerLoc = gl.getUniformLocation(program, "uSampler");
  uUseTextureLoc = gl.getUniformLocation(program, "uUseTexture");
}

const baseUpdateProgram = updateProgram;

updateProgram = function() {
  const success = baseUpdateProgram();

  if (success) {
    cacheUniformLocations();
  }
};

cacheUniformLocations();

const slewSlider = document.getElementById("slewSlider");
const boomSlider = document.getElementById("boomSlider");
const armSlider = document.getElementById("armSlider");
const bucketSlider = document.getElementById("bucketSlider");

const valSlew = document.getElementById("valSlew");
const valBoom = document.getElementById("valBoom");
const valArm = document.getElementById("valArm");
const valBucket = document.getElementById("valBucket");

const autoAnim = document.getElementById("autoAnim");
const light1Toggle = document.getElementById("light1Toggle");
const flatShadingToggle = document.getElementById("flatShadingToggle");

const cabinShininessSlider = document.getElementById("cabinShininessSlider");

const boomShininessSlider = document.getElementById("boomShininessSlider");

const valCabinShininess = document.getElementById("valCabinShininess");

const valBoomShininess = document.getElementById("valBoomShininess");

slewSlider.addEventListener("input", e => valSlew.textContent = `${e.target.value}°`);
boomSlider.addEventListener("input", e => valBoom.textContent = `${e.target.value}°`);
armSlider.addEventListener("input", e => valArm.textContent = `${e.target.value}°`);
bucketSlider.addEventListener("input", e => valBucket.textContent = `${e.target.value}°`);
cabinShininessSlider.addEventListener("input", e => valCabinShininess.textContent = e.target.value);
boomShininessSlider.addEventListener("input", e => valBoomShininess.textContent = e.target.value);

// Dual Lights in World Coordinates
const light0World = [4.0, 7.0, 5.0];     // Key Light (Sun)
const light1World = [-3.0, 2.0, -2.0];   // Cab Worklight 

let lastTime = 0;
function render(time) {
  const t = time / 1000;

  if (spinning) spinAngle += t - lastTime;
  lastTime = t;
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  const view = translate(camX, camY, camZ);
  gl.uniformMatrix4fv(uProjection, false, projection);

  // Supply dual light sources in Eye Space
  gl.uniform3fv(uLightPos0Loc, transformPoint(view, light0World));
  gl.uniform3fv(uLightColor0Loc, [1.0, 0.97, 0.90]); // Warm Sunlight

  gl.uniform3fv(uLightPos1Loc, transformPoint(view, light1World));
  gl.uniform3fv(uLightColor1Loc, [0.35, 0.65, 0.95]); // Cool Excavation Spotlight
  gl.uniform1i(uEnableLight1Loc, light1Toggle.checked ? 1 : 0);

  // Root view rotation
  const axisRotation = ROTATE[axisSelect.value](sliderAngle * Math.PI / 180 + spinAngle);
  const globalRot = multiply(multiply(rotateY(dragRotY), rotateX(dragRotX)), axisRotation);

  // Joint angle management
  let curSlew, curBoom, curArm, curBucket;

  if (autoAnim.checked) {
    const speed = 1.0;
    const phase = t * speed;

    curSlew = Math.sin(phase * 0.5) * 40.0;
    curBoom = 55.0 + Math.sin(phase) * 22.0;
    curArm = -66.0 + Math.cos(phase) * 28.0;
    curBucket = 10.0 + Math.sin(phase + Math.PI * 0.25) * 45.0;

  } else {
    curSlew = Number(slewSlider.value);
    curBoom = Number(boomSlider.value);
    curArm = Number(armSlider.value);
    curBucket = Number(bucketSlider.value);
  }

  // Radians calculation
  const radSlew = curSlew * (Math.PI / 180);
  const radBoom = -curBoom * (Math.PI / 180);
  const radArm = curArm * (Math.PI / 180);
  const radBucket = curBucket * (Math.PI / 180);

  // Relative hierarchical transforms
  body.joint = globalRot;
  cabinJoint.joint = multiply(translate(0.0, -0.70, 0.0), rotateY(radSlew));
  cabin.joint = translate(0.0, 0.0, 0.0);
  upperArm.joint = multiply(translate(0.32, 0.35, 0.0), rotateZ(radBoom));
  lowerArm.joint = multiply(translate(0.0, 1.4, 0.0), rotateZ(radArm));
  bucket.joint = multiply(translate(0.0, 1.0, 0.0), rotateZ(radBucket));


  drawTree(body, view, catTexture, 
    flatShadingToggle.checked);

  requestAnimationFrame(render);
}
requestAnimationFrame(render);
