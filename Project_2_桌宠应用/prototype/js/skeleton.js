class Skeleton {
  constructor(jointsData) {
    this.joints = {};
    this.jointPositions = {};

    for (var name in jointsData) {
      var joint = jointsData[name];
      this.joints[name] = {
        x: joint.x || 0,
        y: joint.y || 0,
        angle: joint.angle || 0,
        parent: joint.parent || null
      };
    }

    this._restAngles = {};
    for (var name in this.joints) {
      this._restAngles[name] = this.joints[name].angle;
    }
  }

  getJointWorldPosition(jointName) {
    var joint = this.joints[jointName];
    if (!joint) return { x: 0, y: 0 };

    if (!joint.parent) {
      return { x: joint.x, y: joint.y, worldAngle: joint.angle };
    }

    var parentPos = this.getJointWorldPosition(joint.parent);
    var parentWorldAngle = parentPos.worldAngle || 0;
    var worldAngle = joint.angle + parentWorldAngle;
    var angleRad = (parentWorldAngle * Math.PI) / 180;

    return {
      x: parentPos.x + joint.x * Math.cos(angleRad) - joint.y * Math.sin(angleRad),
      y: parentPos.y + joint.x * Math.sin(angleRad) + joint.y * Math.cos(angleRad),
      worldAngle: worldAngle
    };
  }

  updateJoints(newAngles) {
    for (var name in newAngles) {
      if (this.joints[name] && newAngles[name].angle !== undefined) {
        this.joints[name].angle = newAngles[name].angle;
      }
    }
  }
}

class PetRenderer {
  constructor(skeleton) {
    this.skeleton = skeleton;
    this.image = null;
    this.imageX = 0;
    this.imageY = 0;
    this.imageScale = 1;

    this.meshRows = 8;
    this.meshCols = 8;
    this.meshVertices = null;
    this.restJoints = null;
  }

  setImage(img, imgX, imgY, imgScale) {
    this.image = img;
    this.imageX = imgX || 0;
    this.imageY = imgY || 0;
    this.imageScale = imgScale || 1;
    this.buildMesh();
  }

  buildMesh() {
    if (!this.image) return;
    var imgW = this.image.width * this.imageScale;
    var imgH = this.image.height * this.imageScale;
    var rows = this.meshRows;
    var cols = this.meshCols;

    this.restJoints = {};
    for (var name in this.skeleton.joints) {
      var pos = this.skeleton.getJointWorldPosition(name);
      this.restJoints[name] = {
        x: pos.x,
        y: pos.y,
        angle: this.skeleton.joints[name].angle || 0
      };
    }

    this.meshVertices = [];
    for (var r = 0; r <= rows; r++) {
      for (var c = 0; c <= cols; c++) {
        this.meshVertices.push({
          x: this.imageX + (c / cols) * imgW,
          y: this.imageY + (r / rows) * imgH
        });
      }
    }
  }

  draw(ctx, x, y, scale) {
    ctx.save();

    if (this.image && this.meshVertices) {
      this.drawWithMesh(ctx, x, y, scale);
    } else {
      ctx.translate(x, y);
      ctx.scale(scale, scale);
      if (this.image) {
        this.drawImage(ctx);
      }
      this.drawBody(ctx);
      this.drawHead(ctx);
      this.drawArms(ctx);
      this.drawLegs(ctx);
    }

    ctx.restore();
  }

  drawImage(ctx) {
    ctx.drawImage(
      this.image,
      this.imageX, this.imageY,
      this.image.width * this.imageScale,
      this.image.height * this.imageScale
    );
  }

  drawWithMesh(ctx, px, py, pscale) {
    if (!this.image || !this.meshVertices || !this.restJoints) return;

    var rows = this.meshRows;
    var cols = this.meshCols;
    var stride = cols + 1;

    var transforms = this._computeBoneTransforms();

    var warped = [];
    for (var i = 0; i < this.meshVertices.length; i++) {
      var v = this.meshVertices[i];
      warped.push(this._transformVertex(v.x, v.y, transforms));
    }

    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var i00 = r * stride + c;
        var i10 = i00 + 1;
        var i01 = (r + 1) * stride + c;
        var i11 = i01 + 1;

        this._drawWarpedCell(ctx, px, py, pscale,
          warped[i00], warped[i10], warped[i11], warped[i01],
          this.meshVertices[i00], this.meshVertices[i10], this.meshVertices[i11], this.meshVertices[i01]
        );
      }
    }
  }

  _drawWarpedCell(ctx, px, py, pscale, wp0, wp1, wp2, wp3, sp0, sp1, sp2, sp3) {
    var sw0 = { x: px + wp0.x * pscale, y: py + wp0.y * pscale };
    var sw1 = { x: px + wp1.x * pscale, y: py + wp1.y * pscale };
    var sw2 = { x: px + wp2.x * pscale, y: py + wp2.y * pscale };
    var sw3 = { x: px + wp3.x * pscale, y: py + wp3.y * pscale };

    var si0 = { x: sp0.x - this.imageX, y: sp0.y - this.imageY };
    var si1 = { x: sp1.x - this.imageX, y: sp1.y - this.imageY };
    var si2 = { x: sp2.x - this.imageX, y: sp2.y - this.imageY };
    var si3 = { x: sp3.x - this.imageX, y: sp3.y - this.imageY };

    this._drawWarpedTriangle(ctx, sw0, sw1, sw2, si0, si1, si2);
    this._drawWarpedTriangle(ctx, sw0, sw2, sw3, si0, si2, si3);
  }

  _drawWarpedTriangle(ctx, sw0, sw1, sw2, si0, si1, si2) {
    var dx1 = si1.x - si0.x;
    var dy1 = si1.y - si0.y;
    var dx2 = si2.x - si0.x;
    var dy2 = si2.y - si0.y;

    var wx1 = sw1.x - sw0.x;
    var wy1 = sw1.y - sw0.y;
    var wx2 = sw2.x - sw0.x;
    var wy2 = sw2.y - sw0.y;

    var det = dx1 * dy2 - dy1 * dx2;
    if (Math.abs(det) < 0.001) return;

    var invDet = 1 / det;
    var a = (wx1 * dy2 - wx2 * dy1) * invDet;
    var c = (wx2 * dx1 - wx1 * dx2) * invDet;
    var e = sw0.x - a * si0.x - c * si0.y;
    var b = (wy1 * dy2 - wy2 * dy1) * invDet;
    var d = (wy2 * dx1 - wy1 * dx2) * invDet;
    var f = sw0.y - b * si0.x - d * si0.y;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(sw0.x, sw0.y);
    ctx.lineTo(sw1.x, sw1.y);
    ctx.lineTo(sw2.x, sw2.y);
    ctx.closePath();
    ctx.clip();

    ctx.setTransform(a, b, c, d, e, f);
    ctx.drawImage(this.image, 0, 0);

    ctx.restore();
  }

  _computeBoneTransforms() {
    var transforms = {};
    for (var name in this.restJoints) {
      var rest = this.restJoints[name];
      var currPos = this.skeleton.getJointWorldPosition(name);
      var currAngle = this.skeleton.joints[name].angle || 0;
      var restAngle = rest.angle || 0;

      var tx = currPos.x - rest.x;
      var ty = currPos.y - rest.y;
      var da = (currAngle - restAngle) * Math.PI / 180;

      transforms[name] = {
        tx: tx, ty: ty,
        cos: Math.cos(da), sin: Math.sin(da),
        restX: rest.x, restY: rest.y
      };
    }
    return transforms;
  }

  _transformVertex(px, py, transforms) {
    var totalWeight = 0;
    var wx = 0, wy = 0;

    for (var name in transforms) {
      var t = transforms[name];
      var dx = px - t.restX;
      var dy = py - t.restY;
      var dist = Math.sqrt(dx * dx + dy * dy);
      var weight = 1 / (dist * dist + 200);

      var rx = t.cos * dx - t.sin * dy;
      var ry = t.sin * dx + t.cos * dy;

      wx += (t.restX + rx + t.tx) * weight;
      wy += (t.restY + ry + t.ty) * weight;
      totalWeight += weight;
    }

    if (totalWeight < 0.0001) return { x: px, y: py };
    return { x: wx / totalWeight, y: wy / totalWeight };
  }

  drawHead(ctx) {
    var headPos = this.skeleton.getJointWorldPosition('head');
    ctx.save();
    ctx.translate(headPos.x, headPos.y);

    ctx.beginPath();
    ctx.arc(0, 0, 25, 0, Math.PI * 2);
    var headGradient = ctx.createRadialGradient(-5, -5, 0, 0, 0, 25);
    headGradient.addColorStop(0, '#FFE4C4');
    headGradient.addColorStop(1, '#DEB887');
    ctx.fillStyle = headGradient;
    ctx.fill();
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(-8, -5, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#333';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(8, -5, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#333';
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(-5, 5);
    ctx.lineTo(0, 10);
    ctx.lineTo(5, 5);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  }

  drawBody(ctx) {
    var spinePos = this.skeleton.getJointWorldPosition('spine');
    var rootPos = this.skeleton.getJointWorldPosition('root');
    ctx.save();
    var centerX = (spinePos.x + rootPos.x) / 2;
    var centerY = (spinePos.y + rootPos.y) / 2;
    var width = 35;
    var height = Math.sqrt(Math.pow(rootPos.x - spinePos.x, 2) + Math.pow(rootPos.y - spinePos.y, 2)) + 10;
    ctx.translate(centerX, centerY);
    var angle = Math.atan2(rootPos.y - spinePos.y, rootPos.x - spinePos.x);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.roundRect(-width / 2, -height / 2, width, height, 10);
    var bodyGradient = ctx.createLinearGradient(0, -height / 2, 0, height / 2);
    bodyGradient.addColorStop(0, '#4A90D9');
    bodyGradient.addColorStop(1, '#357ABD');
    ctx.fillStyle = bodyGradient;
    ctx.fill();
    ctx.strokeStyle = '#2E5C8A';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  drawArms(ctx) {
    this._drawArm(ctx, 'arm_L');
    this._drawArm(ctx, 'arm_R');
  }

  _drawArm(ctx, jointName) {
    var armPos = this.skeleton.getJointWorldPosition(jointName);
    var spinePos = this.skeleton.getJointWorldPosition('spine');
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(spinePos.x, spinePos.y);
    ctx.lineTo(armPos.x, armPos.y);
    ctx.strokeStyle = '#FFE4C4';
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 14;
    ctx.globalAlpha = 0.3;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(armPos.x, armPos.y, 8, 0, Math.PI * 2);
    var handGradient = ctx.createRadialGradient(armPos.x - 2, armPos.y - 2, 0, armPos.x, armPos.y, 8);
    handGradient.addColorStop(0, '#FFE4C4');
    handGradient.addColorStop(1, '#DEB887');
    ctx.fillStyle = handGradient;
    ctx.fill();
    ctx.restore();
  }

  drawLegs(ctx) {
    this._drawLeg(ctx, 'leg_L');
    this._drawLeg(ctx, 'leg_R');
  }

  _drawLeg(ctx, jointName) {
    var legPos = this.skeleton.getJointWorldPosition(jointName);
    var rootPos = this.skeleton.getJointWorldPosition('root');
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(rootPos.x, rootPos.y);
    ctx.lineTo(legPos.x, legPos.y);
    ctx.strokeStyle = '#2E5C8A';
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(legPos.x, legPos.y, 10, 0, Math.PI * 2);
    var footGradient = ctx.createRadialGradient(legPos.x - 2, legPos.y - 2, 0, legPos.x, legPos.y, 10);
    footGradient.addColorStop(0, '#357ABD');
    footGradient.addColorStop(1, '#2E5C8A');
    ctx.fillStyle = footGradient;
    ctx.fill();
    ctx.restore();
  }

  _drawBonesOnly(ctx) {
    ctx.save();
    for (var name in this.skeleton.joints) {
      var joint = this.skeleton.joints[name];
      if (!joint.parent) continue;
      var parent = this.skeleton.joints[joint.parent];
      if (!parent) continue;

      var wp = this.skeleton.getJointWorldPosition(name);
      var pp = this.skeleton.getJointWorldPosition(joint.parent);

      ctx.beginPath();
      ctx.moveTo(pp.x, pp.y);
      ctx.lineTo(wp.x, wp.y);
      ctx.strokeStyle = 'rgba(255, 107, 107, 0.6)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    for (var name in this.skeleton.joints) {
      var wp = this.skeleton.getJointWorldPosition(name);
      ctx.beginPath();
      ctx.arc(wp.x, wp.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 100, 100, 0.9)';
      ctx.fill();
    }
    ctx.restore();
  }
}