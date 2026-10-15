'use strict';

// Model stores ALL vertices in ONE GPU buffer (x,y,z,x,y,z,...).
// Every polyline is described by a descriptor {first, count}:
//   first - index of its first vertex in the buffer,
//   count - number of vertices in the polyline.
// U polylines (u varies, v = const) and V polylines (v varies, u = const)
// are kept in two separate arrays of descriptors.
function Model(name) {
    this.name = name;
    this.iVertexBuffer = gl.createBuffer();
    this.uPolylines = [];   // [{first, count}, ...]
    this.vPolylines = [];   // [{first, count}, ...]

    // uCurves, vCurves: arrays of polylines, each polyline = array of [x, y, z]
    this.BufferData = function (uCurves, vCurves) {
        let flat = [];
        this.uPolylines = [];
        this.vPolylines = [];

        const pack = (curves, target) => {
            for (const curve of curves) {
                target.push({ first: flat.length / 3, count: curve.length });
                for (const p of curve) flat.push(p[0], p[1], p[2]);
            }
        };
        pack(uCurves, this.uPolylines);
        pack(vCurves, this.vPolylines);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(flat), gl.STATIC_DRAW);
    };

    this.Draw = function () {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribVertex);

        gl.uniform4fv(shProgram.iColor, [1, 1, 0, 1]);   // U lines - yellow
        for (const l of this.uPolylines)
            gl.drawArrays(gl.LINE_STRIP, l.first, l.count);

        gl.uniform4fv(shProgram.iColor, [0, 1, 1, 1]);   // V lines - cyan
        for (const l of this.vPolylines)
            gl.drawArrays(gl.LINE_STRIP, l.first, l.count);
    };
}