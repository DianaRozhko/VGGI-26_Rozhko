'use strict';

let gl;                         // The webgl context.
let surface;                    // A surface model
let shProgram;                  // A shader program
let spaceball;                  // A SimpleRotator object that lets the user rotate the view by mouse.

// ---- Astroidal torus parameters (The book of surfaces, Fig. 3, scaled by 0.5) ----
const a     = 0.5;              // size of the generatrix astroid
const r     = 1.0;              // distance of the astroid from the rotation axis
const theta = 0.25 * Math.PI;   // rotation angle of the astroid's local axes

function deg2rad(angle) {
    return angle * Math.PI / 180;
}


// Constructor
function ShaderProgram(name, program) {

    this.name = name;
    this.prog = program;

    // Location of the attribute variable in the shader program.
    this.iAttribVertex = -1;
    // Location of the uniform specifying a color for the primitive.
    this.iColor = -1;
    // Location of the uniform matrix representing the combined transformation.
    this.iModelViewProjectionMatrix = -1;

    this.Use = function() {
        gl.useProgram(this.prog);
    }
}


function draw() { 
    gl.clearColor(0,0,0,1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    /* Set the values of the projection transformation */
    let projection = m4.perspective(Math.PI/8, 1, 8, 12); 
    
    /* Get the view matrix from the SimpleRotator object.*/
    let modelView = spaceball.getViewMatrix();

    let rotateToPointZero = m4.axisRotation([0.707,0.707,0], 0.7);
    let translateToPointZero = m4.translation(0,0,-10);

    let matAccum0 = m4.multiply(rotateToPointZero, modelView );
    let matAccum1 = m4.multiply(translateToPointZero, matAccum0 );
        
    /* Multiply the projection matrix times the modelview matrix to give the
       combined transformation matrix, and send that to the shader program. */
    let modelViewProjection = m4.multiply(projection, matAccum1 );

    gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, modelViewProjection );

    surface.Draw();
}


// Point of the astroidal torus, parameters: u in [-PI, PI], v in [0, 2*PI]
//   x(u) = a*cos^3(u),  z(u) = a*sin^3(u)
//   X = [r + x(u)*cos(theta) - z(u)*sin(theta)] * cos(v)
//   Y = [r + x(u)*cos(theta) - z(u)*sin(theta)] * sin(v)
//   Z = x(u)*sin(theta) + z(u)*cos(theta)
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


// Returns [uCurves, vCurves]; each curve is an array of [x, y, z]
function CreateSurfaceData()
{
    const N = 36;   // number of polylines in each set
    const M = 72;   // segments in each polyline
    const uMin = -Math.PI, uMax = Math.PI;
    const vMin = 0,        vMax = 2 * Math.PI;
    const uCurves = [], vCurves = [];

    // U polylines: u runs uMin..uMax (the astroid), v is fixed
    for (let j = 0; j <= N; j++) {
        const v = vMin + (vMax - vMin) * j / N;
        const curve = [];
        for (let k = 0; k <= M; k++)
            curve.push(surfacePoint(uMin + (uMax - uMin) * k / M, v));
        uCurves.push(curve);
    }

    // V polylines: v runs vMin..vMax (the circle), u is fixed
    for (let i = 0; i <= N; i++) {
        const u = uMin + (uMax - uMin) * i / N;
        const curve = [];
        for (let k = 0; k <= M; k++)
            curve.push(surfacePoint(u, vMin + (vMax - vMin) * k / M));
        vCurves.push(curve);
    }

    return [uCurves, vCurves];
}


/* Initialize the WebGL context. Called from init() */
function initGL() {
    let prog = createProgram( gl, vertexShaderSource, fragmentShaderSource );

    shProgram = new ShaderProgram('Basic', prog);
    shProgram.Use();

    shProgram.iAttribVertex              = gl.getAttribLocation(prog, "vertex");
    shProgram.iModelViewProjectionMatrix = gl.getUniformLocation(prog, "ModelViewProjectionMatrix");
    shProgram.iColor                     = gl.getUniformLocation(prog, "color");

    surface = new Model('Surface');
    const [uCurves, vCurves] = CreateSurfaceData();
    surface.BufferData(uCurves, vCurves);

    gl.enable(gl.DEPTH_TEST);
}


function createProgram(gl, vShader, fShader) {
    let vsh = gl.createShader( gl.VERTEX_SHADER );
    gl.shaderSource(vsh,vShader);
    gl.compileShader(vsh);
    if ( ! gl.getShaderParameter(vsh, gl.COMPILE_STATUS) ) {
        throw new Error("Error in vertex shader:  " + gl.getShaderInfoLog(vsh));
     }
    let fsh = gl.createShader( gl.FRAGMENT_SHADER );
    gl.shaderSource(fsh, fShader);
    gl.compileShader(fsh);
    if ( ! gl.getShaderParameter(fsh, gl.COMPILE_STATUS) ) {
       throw new Error("Error in fragment shader:  " + gl.getShaderInfoLog(fsh));
    }
    let prog = gl.createProgram();
    gl.attachShader(prog,vsh);
    gl.attachShader(prog, fsh);
    gl.linkProgram(prog);
    if ( ! gl.getProgramParameter( prog, gl.LINK_STATUS) ) {
       throw new Error("Link error in program:  " + gl.getProgramInfoLog(prog));
    }
    return prog;
}


function init() {
    let canvas;
    try {
        canvas = document.getElementById("webglcanvas");
        gl = canvas.getContext("webgl");
        if ( ! gl ) {
            throw "Browser does not support WebGL";
        }
    }
    catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not get a WebGL graphics context.</p>";
        return;
    }
    try {
        initGL();  // initialize the WebGL graphics context
    }
    catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not initialize the WebGL graphics context: " + e + "</p>";
        return;
    }

    spaceball = new TrackballRotator(canvas, draw, 0);

    draw();
}