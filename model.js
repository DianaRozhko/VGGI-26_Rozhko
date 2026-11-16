'use strict';

function Model(name) {
    this.name = name;
    this.iVertexBuffer = gl.createBuffer();
    this.iNormalBuffer = gl.createBuffer();
    this.iIndexBuffer = gl.createBuffer();
    this.count = 0;

    this.BufferData = function (N, M, surfacePointFunc) {
        // Захист від невалідних значень N та M
        N = parseInt(N);
        M = parseInt(M);
        if (isNaN(N) || N <= 0) N = 36;
        if (isNaN(M) || M <= 0) M = 36;

        let vertices = [];
        let indices = [];

        const uMin = -Math.PI, uMax = Math.PI;
        const vMin = 0, vMax = 2 * Math.PI;

        // 1. Генерація сітки вершин
        for (let i = 0; i <= N; i++) {
            const u = uMin + (uMax - uMin) * i / N;
            for (let j = 0; j <= M; j++) {
                const v = vMin + (vMax - vMin) * j / M;
                const p = surfacePointFunc(u, v);
                vertices.push(p[0], p[1], p[2]);
            }
        }

        // 2. Генерація індексів трикутників
        for (let i = 0; i < N; i++) {
            for (let j = 0; j < M; j++) {
                let p00 = i * (M + 1) + j;
                let p10 = (i + 1) * (M + 1) + j;
                let p01 = i * (M + 1) + (j + 1);
                let p11 = (i + 1) * (M + 1) + (j + 1);

                // Трикутник 1
                indices.push(p00, p10, p11);
                // Трикутник 2
                indices.push(p00, p11, p01);
            }
        }

        // 3. Обчислення нормалей: Facet Angle Weighted Average (Варіант 21)
        const vertexCount = (N + 1) * (M + 1);
        let normals = [];
        for (let i = 0; i < vertexCount; i++) {
            normals.push([0, 0, 0]);
        }

        for (let t = 0; t < indices.length; t += 3) {
            let i0 = indices[t];
            let i1 = indices[t+1];
            let i2 = indices[t+2];

            let p0 = [vertices[i0*3], vertices[i0*3+1], vertices[i0*3+2]];
            let p1 = [vertices[i1*3], vertices[i1*3+1], vertices[i1*3+2]];
            let p2 = [vertices[i2*3], vertices[i2*3+1], vertices[i2*3+2]];

            let v01 = [p1[0]-p0[0], p1[1]-p0[1], p1[2]-p0[2]];
            let v02 = [p2[0]-p0[0], p2[1]-p0[1], p2[2]-p0[2]];
            let v10 = [p0[0]-p1[0], p0[1]-p1[1], p0[2]-p1[2]];
            let v12 = [p2[0]-p1[0], p2[1]-p1[1], p2[2]-p1[2]];
            let v20 = [p0[0]-p2[0], p0[1]-p2[1], p0[2]-p2[2]];
            let v21 = [p1[0]-p2[0], p1[1]-p2[1], p1[2]-p2[2]];

            let nx = v01[1] * v02[2] - v01[2] * v02[1];
            let ny = v01[2] * v02[0] - v01[0] * v02[2];
            let nz = v01[0] * v02[1] - v01[1] * v02[0];
            let len = Math.sqrt(nx*nx + ny*ny + nz*nz);
            if (len > 0) { nx /= len; ny /= len; nz /= len; }
            let fn = [nx, ny, nz];

            function angleBetween(a, b) {
                let dot = a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
                let la = Math.sqrt(a[0]*a[0] + a[1]*a[1] + a[2]*a[2]);
                let lb = Math.sqrt(b[0]*b[0] + b[1]*b[1] + b[2]*b[2]);
                if (la === 0 || lb === 0) return 0;
                let val = dot / (la * lb);
                val = Math.max(-1, Math.min(1, val));
                return Math.acos(val);
            }

            let angle0 = angleBetween(v01, v02);
            let angle1 = angleBetween(v10, v12);
            let angle2 = angleBetween(v20, v21);

            normals[i0][0] += fn[0] * angle0;
            normals[i0][1] += fn[1] * angle0;
            normals[i0][2] += fn[2] * angle0;

            normals[i1][0] += fn[0] * angle1;
            normals[i1][1] += fn[1] * angle1;
            normals[i1][2] += fn[2] * angle1;

            normals[i2][0] += fn[0] * angle2;
            normals[i2][1] += fn[1] * angle2;
            normals[i2][2] += fn[2] * angle2;
        }

        let flatNormals = [];
        for (let i = 0; i < vertexCount; i++) {
            let nx = normals[i][0];
            let ny = normals[i][1];
            let nz = normals[i][2];
            let len = Math.sqrt(nx*nx + ny*ny + nz*nz);
            if (len > 0) {
                nx /= len; ny /= len; nz /= len;
            } else {
                nx = 0; ny = 0; nz = 1;
            }
            flatNormals.push(nx, ny, nz);
        }

        this.count = indices.length;

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iNormalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(flatNormals), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iIndexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
    };

    this.Draw = function () {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribVertex);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iNormalBuffer);
        gl.vertexAttribPointer(shProgram.iAttribNormal, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribNormal);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iIndexBuffer);

        // Встановлюємо рожевий колір (RGBA: Red, Green, Blue, Alpha)
        gl.uniform4fv(shProgram.iColor, [1.0, 0.4, 0.7, 1.0]); 
        gl.drawElements(gl.TRIANGLES, this.count, gl.UNSIGNED_SHORT, 0);
    };
}