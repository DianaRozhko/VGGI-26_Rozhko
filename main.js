'use strict';

let gl;
let surface;
let shProgram;
let spaceball;

let diffuseTexture;
let specularTexture;
let normalTexture;

const a     = 0.5;
const r     = 1.0;
const theta = 0.25 * Math.PI;

let lightAngle = 0.0;

function ShaderProgram(name, program) {
    this.name = name;
    this.prog = program;

    this.iAttribVertex = -1;
    this.iAttribNormal = -1;
    this.iAttribTexCoord = -1;
    this.iAttribTangent = -1;

    this.iModelViewMatrix = -1;
    this.iModelViewProjectionMatrix = -1;
    this.iLightPosition = -1;

    this.iDiffuseMap = -1;
    this.iSpecularMap = -1;
    this.iNormalMap = -1;

    this.Use = function() {
        gl.useProgram(this.prog);
    }
}

function loadTexture(url) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);

    // Тимчасова заглушка 1x1 піксель, поки файл завантажується
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
                  new Uint8Array([128, 128, 255, 255]));

    const image = new Image();
    image.onload = function() {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

        if ((image.width & (image.width - 1)) === 0 && (image.height & (image.height - 1)) === 0) {
            gl.generateMipmap(gl.TEXTURE_2D);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        } else {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        }
    };
    image.src = url;
    return texture;
}

function multiplyMatrixVector(m, v) {
    return [
        m[0]*v[0] + m[4]*v[1] + m[8]*v[2] + m[12]*v[3],
        m[1]*v[0] + m[5]*v[1] + m[9]*v[2] + m[13]*v[3],
        m[2]*v[0] + m[6]*v[1] + m[10]*v[2] + m[14]*v[3],
        m[3]*v[0] + m[7]*v[1] + m[11]*v[2] + m[15]*v[3]
    ];
}

function draw() { 
    gl.clearColor(0.1, 0.1, 0.1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    let projection = m4.perspective(Math.PI/8, 1, 8, 12); 
    let modelView = spaceball.getViewMatrix();

    let rotateToPointZero = m4.axisRotation([0.707, 0.707, 0], 0.7);
    let translateToPointZero = m4.translation(0, 0, -10);

    let matAccum0 = m4.multiply(rotateToPointZero, modelView);
    let matAccum1 = m4.multiply(translateToPointZero, matAccum0);
        
    let modelViewProjection = m4.multiply(projection, matAccum1);

    gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, matAccum1);
    gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, modelViewProjection);

    lightAngle += 0.02;
    let lightWorldPos = [3.0 * Math.cos(lightAngle), 3.0 * Math.sin(lightAngle), 2.0];
    let lightPosEye4 = multiplyMatrixVector(matAccum1, [lightWorldPos[0], lightWorldPos[1], lightWorldPos[2], 1.0]);
    let lightPosEye = [lightPosEye4[0]/lightPosEye4[3], lightPosEye4[1]/lightPosEye4[3], lightPosEye4[2]/lightPosEye4[3]];

    gl.uniform3fv(shProgram.iLightPosition, lightPosEye);

    // Підключення трьох текстур до відповідних юнітів
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, diffuseTexture);
    gl.uniform1i(shProgram.iDiffuseMap, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, specularTexture);
    gl.uniform1i(shProgram.iSpecularMap, 1);

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, normalTexture);
    gl.uniform1i(shProgram.iNormalMap, 2);

    surface.Draw();
}

function surfacePoint(u, v) {
    const xu = a * Math.pow(Math.cos(u), 3);
    const zu = a * Math.pow(Math.sin(u), 3);
    const rho = r + xu * Math.cos(theta) - zu * Math.sin(theta);
    return [
        rho * Math.cos(v),
        rho * Math.sin(v),
        xu * Math.sin(theta) + zu * Math.cos(theta)
    ];
}

function initGL() {
    let prog = createProgram(gl, vertexShaderSource, fragmentShaderSource);

    shProgram = new ShaderProgram('Basic', prog);
    shProgram.Use();

    shProgram.iAttribVertex              = gl.getAttribLocation(prog, "vertex");
    shProgram.iAttribNormal              = gl.getAttribLocation(prog, "normal");
    shProgram.iAttribTexCoord            = gl.getAttribLocation(prog, "texCoord");
    shProgram.iAttribTangent             = gl.getAttribLocation(prog, "tangent");

    shProgram.iModelViewMatrix           = gl.getUniformLocation(prog, "ModelViewMatrix");
    shProgram.iModelViewProjectionMatrix = gl.getUniformLocation(prog, "ModelViewProjectionMatrix");
    shProgram.iLightPosition             = gl.getUniformLocation(prog, "lightPosition");

    shProgram.iDiffuseMap                = gl.getUniformLocation(prog, "uDiffuseMap");
    shProgram.iSpecularMap               = gl.getUniformLocation(prog, "uSpecularMap");
    shProgram.iNormalMap                 = gl.getUniformLocation(prog, "uNormalMap");

    // Завантаження файлів текстур (перевір назви та розширення!)
    diffuseTexture  = loadTexture('diffuse.png');
    specularTexture = loadTexture('specular.png');
    normalTexture   = loadTexture('normal.png');

    surface = new Model('Surface');
    
    let nInput = document.getElementById("nSlider");
    let mInput = document.getElementById("mSlider");
    let N = nInput ? parseInt(nInput.value) : 36;
    let M = mInput ? parseInt(mInput.value) : 36;
    if (isNaN(N) || N <= 0) N = 36;
    if (isNaN(M) || M <= 0) M = 36;

    surface.BufferData(N, M, surfacePoint);

    gl.enable(gl.DEPTH_TEST);
}

function updateGranularity() {
    let nInput = document.getElementById("nSlider");
    let mInput = document.getElementById("mSlider");
    if (!nInput || !mInput) return;

    let N = parseInt(nInput.value);
    let M = parseInt(mInput.value);
    if (isNaN(N) || N <= 0) N = 36;
    if (isNaN(M) || M <= 0) M = 36;
    
    let nVal = document.getElementById("nVal");
    let mVal = document.getElementById("mVal");
    if (nVal) nVal.innerText = N;
    if (mVal) mVal.innerText = M;

    if (surface) {
        surface.BufferData(N, M, surfacePoint);
        draw();
    }
}

function createProgram(gl, vShader, fShader) {
    let vsh = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vsh, vShader);
    gl.compileShader(vsh);
    if (!gl.getShaderParameter(vsh, gl.COMPILE_STATUS)) {
        throw new Error("Error in vertex shader: " + gl.getShaderInfoLog(vsh));
    }
    let fsh = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fsh, fShader);
    gl.compileShader(fsh);
    if (!gl.getShaderParameter(fsh, gl.COMPILE_STATUS)) {
        throw new Error("Error in fragment shader: " + gl.getShaderInfoLog(fsh));
    }
    let prog = gl.createProgram();
    gl.attachShader(prog, vsh);
    gl.attachShader(prog, fsh);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        throw new Error("Link error in program: " + gl.getProgramInfoLog(prog));
    }
    return prog;
}

function init() {
    let canvas;
    try {
        canvas = document.getElementById("webglcanvas");
        gl = canvas.getContext("webgl");
        if (!gl) {
            throw "Browser does not support WebGL";
        }
    }
    catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not get a WebGL graphics context.</p>";
        return;
    }
    try {
        initGL();
    }
    catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not initialize the WebGL graphics context: " + e + "</p>";
        return;
    }

    spaceball = new TrackballRotator(canvas, draw, 0);

    function animLoop() {
        draw();
        requestAnimationFrame(animLoop);
    }
    animLoop();
}