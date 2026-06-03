class SkeletonEditor {
  constructor(canvas, onSave, onClose) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onSave = onSave;
    this.onClose = onClose;

    this.image = null;
    this.imageX = 0;
    this.imageY = 0;
    this.imageScale = 1;

    this.joints = {};
    this.jointRadius = 10;
    this.draggingJoint = null;
    this.isPreviewing = false;

    this.step = 1;
    this.totalSteps = 6;

    this.characterName = '';
    this.selectedModuleId = null;
    this.moduleData = null;

    this.skeletonForRender = null;
    this.rendererForPreview = null;
    this.animPlayerForPreview = null;

    this._previewFrameId = null;
  }

  enter(existingBinding) {
    this.step = 1;
    this.characterName = '';
    this.selectedModuleId = null;
    this.moduleData = null;
    this.image = null;
    this.joints = {};
    this.isPreviewing = false;
    this.stopPreview();
    this._existingBinding = existingBinding || null;
    this._editingPetIndex = (existingBinding) ? existingBinding.petIndex : -1;
    this._editingPet = (existingBinding) ? existingBinding.pet : null;
    this.updateStepUI();
    this.render();
  }

  updateStepUI() {
    var status = document.getElementById('editor-status');
    var content = document.getElementById('editor-step-content');
    var prevBtn = document.getElementById('editor-prev');
    var nextBtn = document.getElementById('editor-next');

    var stepSpans = document.querySelectorAll('#editor-steps span');
    for (var i = 0; i < stepSpans.length; i++) {
      stepSpans[i].style.color = '#999';
      stepSpans[i].style.fontWeight = 'normal';
    }
    var stepIdx = (this.step - 1) * 2;
    if (stepSpans[stepIdx]) {
      stepSpans[stepIdx].style.color = '#764ba2';
      stepSpans[stepIdx].style.fontWeight = 'bold';
    }

    this.isPreviewing = false;
    this.stopPreview();

    switch (this.step) {
      case 1:
        status.textContent = '请输入角色名称';
        this.renderStep1(content);
        break;
      case 2:
        status.textContent = '请选择动作模组';
        this.renderStep2(content);
        break;
      case 3:
        status.textContent = '请导入角色PNG图片';
        this.renderStep3(content);
        break;
      case 4:
        status.textContent = '拖拽骨骼关节到对应位置';
        this.renderStep4(content);
        break;
      case 5:
        status.textContent = '预览动画效果';
        this.renderStep5(content);
        break;
      case 6:
        status.textContent = '确认并保存角色配置';
        this.renderStep6(content);
        break;
    }

    prevBtn.style.display = this.step > 1 ? 'block' : 'none';
    nextBtn.textContent = this.step === this.totalSteps ? '完成保存' : '下一步';
  }

  renderStep1(content) {
    this.clearCanvas();
    content.innerHTML =
      '<div style="margin-bottom:10px;">' +
      '<label style="font-size:12px;color:#666;">角色名称</label>' +
      '<input id="editor-char-name" type="text" value="' + (this.characterName || '') + '" placeholder="输入角色名称" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:8px;font-size:13px;box-sizing:border-box;">' +
      '</div>' +
      '<div style="font-size:12px;color:#999;">或从已有角色列表选择：</div>' +
      '<div id="editor-char-list" style="max-height:120px;overflow-y:auto;margin-top:6px;"></div>';

    var self = this;
    var nameInput = document.getElementById('editor-char-name');
    if (nameInput) {
      nameInput.addEventListener('input', function() {
        self.characterName = this.value;
        if (self._selectedCharPet && self._selectedCharPet.name !== this.value) {
          self._selectedCharPet = null;
          self._selectedCharHasBinding = false;
        }
      });
    }

    var charList = document.getElementById('editor-char-list');
    if (charList) {
      var pets = window.petApp ? window.petApp.petManager.pets : [];
      var self = this;
      if (pets.length === 0) {
        charList.innerHTML = '<div style="font-size:12px;color:#ccc;">暂无已有角色</div>';
      } else {
        charList.innerHTML = pets.map(function(p) {
          var hasBinding = p.characterBinding ? ' (已有模组)' : '';
          var isEditing = (self._editingPet === p);
          var bgStyle = isEditing ? 'background:#e8f4fd;' : '';
          return '<div class="editor-char-item" data-name="' + p.name + '" data-index="' + pets.indexOf(p) + '" data-has-binding="' + (!!p.characterBinding) + '" style="padding:6px 8px;border-radius:6px;cursor:pointer;font-size:13px;margin-bottom:2px;' + bgStyle + '">' + p.name + '<span style="color:#999;font-size:11px;">' + hasBinding + '</span></div>';
        }).join('');
        charList.querySelectorAll('.editor-char-item').forEach(function(item) {
          item.addEventListener('click', function() {
            self.characterName = this.dataset.name;
            var input = document.getElementById('editor-char-name');
            if (input) input.value = self.characterName;
            self._selectedCharIndex = parseInt(this.dataset.index);
            self._selectedCharHasBinding = this.dataset.hasBinding === 'true';
            self._selectedCharPet = pets[self._selectedCharIndex];
          });
        });

        if (self._editingPet) {
          var editIdx = pets.indexOf(self._editingPet);
          if (editIdx >= 0) {
            self._selectedCharIndex = editIdx;
            self._selectedCharHasBinding = !!self._editingPet.characterBinding;
            self._selectedCharPet = self._editingPet;
          }
        }
      }
    }
  }

  renderStep2(content) {
    this.clearCanvas();
    var self = this;

    var existingModuleId = (this._selectedCharPet && this._selectedCharPet.characterBinding && this._selectedCharPet.moduleData)
      ? this._selectedCharPet.moduleData.id : null;

    var modulesHtml = CONFIG.modules.map(function(m) {
      var selected = self.selectedModuleId === m.id ? 'border:2px solid #764ba2;background:#f3eeff;' : 'border:1px solid #ddd;';
      var isBound = (existingModuleId === m.id);
      var badge = isBound ? '<span style="display:inline-block;background:#27ae60;color:white;font-size:10px;padding:1px 6px;border-radius:4px;margin-left:6px;">已绑定</span>' : '';
      return '<div class="editor-module-item" data-id="' + m.id + '" style="padding:10px;margin-bottom:6px;border-radius:8px;cursor:pointer;' + selected + '">' +
        '<div style="font-weight:bold;font-size:13px;">' + m.name + badge + '</div>' +
        '<div style="font-size:11px;color:#888;">' + m.description + '</div>' +
        '<div style="font-size:11px;color:#aaa;">' + Object.keys(m.skeleton.joints).length + '个关节 | ' + Object.keys(m.animations).length + '个动作</div>' +
        '</div>';
    }).join('');

    content.innerHTML = '<div style="font-size:12px;color:#666;margin-bottom:8px;">选择一个动作模组：</div>' + modulesHtml;

    var self = this;
    content.querySelectorAll('.editor-module-item').forEach(function(item) {
      item.addEventListener('click', function() {
        self.selectModule(this.dataset.id);
        self.renderStep2(content);
      });
    });
  }

  selectModule(moduleId) {
    this.selectedModuleId = moduleId;
    this.moduleData = getModuleById(moduleId);
    var template = this.moduleData.skeleton.joints;
    this.joints = {};
    for (var name in template) {
      this.joints[name] = {
        x: template[name].x || 0,
        y: template[name].y || 0,
        parent: template[name].parent || null
      };
    }
  }

  renderStep3(content) {
    content.innerHTML =
      '<div style="text-align:center;padding:20px 0;">' +
      '<div id="editor-import-area" style="border:2px dashed #764ba2;border-radius:12px;padding:30px;cursor:pointer;">' +
      '<div style="font-size:36px;margin-bottom:8px;">📁</div>' +
      '<div style="font-size:13px;color:#764ba2;">点击此处选择 PNG 图片</div>' +
      '</div>' +
      '</div>';

    var self = this;
    var importArea = document.getElementById('editor-import-area');
    var fileInput = document.getElementById('editor-file');
    if (importArea) {
      importArea.addEventListener('click', function() {
        fileInput.click();
      });
    }
    fileInput.addEventListener('change', function(e) {
      if (e.target.files[0]) {
        self.loadImage(e.target.files[0]);
      }
    });

    if (this.image) {
      this.fitImageToCanvas();
      this.render();
    } else {
      this.clearCanvas();
    }
  }

  renderStep4(content) {
    content.innerHTML =
      '<button id="editor-auto" style="width:100%;margin-bottom:6px;padding:8px;border:1px solid #764ba2;border-radius:8px;background:white;color:#764ba2;cursor:pointer;">一键预估骨骼</button>' +
      '<button id="editor-reset" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:8px;background:white;cursor:pointer;">重置骨骼位置</button>' +
      '<div style="font-size:11px;color:#999;margin-top:6px;">在画布上拖拽彩色圆点调整关节位置</div>';

    var self = this;
    document.getElementById('editor-auto').addEventListener('click', function() {
      self.autoEstimate();
    });
    document.getElementById('editor-reset').addEventListener('click', function() {
      self.resetJoints();
    });

    if (!this.image) {
      this.updateStatus('请先在步骤3导入PNG图片');
    } else {
      this.fitImageToCanvas();
      this.render();
    }
  }

  renderStep5(content) {
    var btnText = this.isPreviewing ? '停止预览' : '播放预览';
    content.innerHTML =
      '<button id="editor-preview-btn" style="width:100%;padding:8px;border:1px solid #4A90D9;border-radius:8px;background:#4A90D9;color:white;cursor:pointer;margin-bottom:6px;">' + btnText + '</button>' +
      '<div style="font-size:11px;color:#999;">预览当前骨骼绑定下的动画效果</div>';

    var self = this;
    document.getElementById('editor-preview-btn').addEventListener('click', function() {
      if (self.isPreviewing) {
        self.stopPreview();
        this.textContent = '播放预览';
      } else {
        self.startPreview();
        this.textContent = '停止预览';
      }
    });

    this.fitImageToCanvas();
    this.render();
  }

  renderStep6(content) {
    var modName = this.moduleData ? this.moduleData.name : '未选择';
    var imgStatus = this.image ? '已导入' : '未导入';
    content.innerHTML =
      '<div style="font-size:13px;margin-bottom:10px;">' +
      '<div style="margin-bottom:4px;"><b>角色名称：</b>' + (this.characterName || '未输入') + '</div>' +
      '<div style="margin-bottom:4px;"><b>动作模组：</b>' + modName + '</div>' +
      '<div style="margin-bottom:4px;"><b>图片：</b>' + imgStatus + '</div>' +
      '<div style="margin-bottom:4px;"><b>骨骼关节：</b>' + Object.keys(this.joints).length + '个</div>' +
      '</div>' +
      '<div id="editor-save-btn" style="width:100%;padding:10px;border:none;border-radius:8px;background:#27ae60;color:white;cursor:pointer;font-size:14px;text-align:center;">保存角色配置</div>' +
      '<div style="font-size:11px;color:#999;margin-top:6px;">保存后将在桌宠中展示带骨骼动画的PNG角色</div>';

    var self = this;
    document.getElementById('editor-save-btn').addEventListener('click', function() {
      self.save();
    });

    this.fitImageToCanvas();
    this.render();
  }

  nextStep() {
    if (this.step === 1) {
      var nameInput = document.getElementById('editor-char-name');
      if (nameInput) this.characterName = nameInput.value.trim();
      if (!this.characterName) {
        alert('请输入角色名称');
        return;
      }
      if (this._selectedCharPet && this._selectedCharPet.name !== this.characterName) {
        this._selectedCharPet = null;
        this._selectedCharHasBinding = false;
      }
    }
    if (this.step === 2) {
      if (!this.selectedModuleId) {
        alert('请选择一个动作模组');
        return;
      }
      if (this._selectedCharPet && this._selectedCharPet.characterBinding &&
          this._selectedCharPet.moduleData && this._selectedCharPet.moduleData.id === this.selectedModuleId) {
        this._loadPetBinding(this._selectedCharPet);
        this.step = 4;
        this.updateStepUI();
        return;
      }
    }
    if (this.step === 3) {
      if (!this.image) {
        alert('请导入一张PNG图片');
        return;
      }
    }
    if (this.step === this.totalSteps) {
      this.save();
      return;
    }
    this.step++;
    this.updateStepUI();
  }

  prevStep() {
    if (this.step > 1) {
      this.step--;
      this.isPreviewing = false;
      this.stopPreview();
      this.updateStepUI();
    }
  }

  loadImage(file) {
    var reader = new FileReader();
    var self = this;
    reader.onload = function(e) {
      var img = new Image();
      img.onload = function() {
        self.image = img;
        self.fitImageToCanvas();
        self.updateStatus('图片已加载');
        self.render();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  fitImageToCanvas() {
    if (!this.image) return;

    var maxW = this.canvas.width * 0.6;
    var maxH = this.canvas.height * 0.7;

    var scaleX = maxW / this.image.width;
    var scaleY = maxH / this.image.height;
    this.imageScale = Math.min(scaleX, scaleY, 1);

    this.imageX = (this.canvas.width - this.image.width * this.imageScale) / 2;
    this.imageY = (this.canvas.height - this.image.height * this.imageScale) / 2;
  }

  autoEstimate() {
    if (!this.image) {
      this.updateStatus('请先导入图片');
      return;
    }

    var imgW = this.image.width * this.imageScale;
    var imgH = this.image.height * this.imageScale;
    var cx = this.imageX + imgW / 2;
    var left = this.imageX;
    var top = this.imageY;
    var bottom = this.imageY + imgH;
    var right = this.imageX + imgW;

    if (this.joints.root) {
      this.joints.root.x = cx;
      this.joints.root.y = this.imageY + imgH * 0.65;
    }
    if (this.joints.spine) {
      this.joints.spine.x = cx;
      this.joints.spine.y = this.imageY + imgH * 0.4;
    }
    if (this.joints.head) {
      this.joints.head.x = cx;
      this.joints.head.y = this.imageY + imgH * 0.15;
    }
    if (this.joints.arm_L) {
      this.joints.arm_L.x = left;
      this.joints.arm_L.y = this.imageY + imgH * 0.45;
    }
    if (this.joints.arm_R) {
      this.joints.arm_R.x = right;
      this.joints.arm_R.y = this.imageY + imgH * 0.45;
    }
    if (this.joints.leg_L) {
      this.joints.leg_L.x = cx - imgW * 0.2;
      this.joints.leg_L.y = bottom;
    }
    if (this.joints.leg_R) {
      this.joints.leg_R.x = cx + imgW * 0.2;
      this.joints.leg_R.y = bottom;
    }

    this.updateStatus('骨骼自动预估完成，可手动微调');
    this.render();
  }

  resetJoints() {
    if (!this.moduleData) return;
    var template = this.moduleData.skeleton.joints;
    this.joints = {};
    for (var name in template) {
      this.joints[name] = {
        x: template[name].x || 0,
        y: template[name].y || 0,
        parent: template[name].parent || null
      };
    }
    this.updateStatus('骨骼已重置');
    this.render();
  }

  startPreview() {
    if (!this.image || !this.moduleData) {
      this.updateStatus('请先完成角色创建、模组选择和图片导入');
      return;
    }

    this.isPreviewing = true;
    this.updateStatus('骨骼预览模式');

    var jointsData = {};
    for (var name in this.joints) {
      jointsData[name] = { x: this.joints[name].x, y: this.joints[name].y, angle: 0, parent: null };
    }
    this.skeletonForRender = new Skeleton(jointsData);
    this.rendererForPreview = new PetRenderer(this.skeletonForRender);
    this.rendererForPreview.setImage(this.image, this.imageX, this.imageY, this.imageScale);
    this.animPlayerForPreview = new AnimationPlayer(this.moduleData.animations);

    this.animPlayerForPreview.play('idle');
    this._previewLoop();
  }

  stopPreview() {
    this.isPreviewing = false;
    if (this._previewFrameId) {
      cancelAnimationFrame(this._previewFrameId);
      this._previewFrameId = null;
    }
    this.skeletonForRender = null;
    this.rendererForPreview = null;
    this.animPlayerForPreview = null;
  }

  _previewLoop() {
    if (!this.isPreviewing) return;
    var self = this;
    this._previewFrameId = requestAnimationFrame(function() {
      self._previewLoop();
    });

    if (this.skeletonForRender && this.animPlayerForPreview) {
      var jointAngles = this.animPlayerForPreview.update(16);
      this.skeletonForRender.updateJoints(jointAngles);
    }

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (this.rendererForPreview) {
      this.rendererForPreview.skeleton = this.skeletonForRender;
      this.rendererForPreview.draw(this.ctx, 0, 0, 1.0);
      this.rendererForPreview._drawBonesOnly(this.ctx);
    }
  }

  render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (this.isPreviewing) {
      if (this.rendererForPreview) {
        this.rendererForPreview.skeleton = this.skeletonForRender;
        this.rendererForPreview.draw(this.ctx, 0, 0, 1.0);
        this.rendererForPreview._drawBonesOnly(this.ctx);
      }
      return;
    }

    this.renderImage();
    this.renderBones();
    this.renderJoints();
  }

  renderImage() {
    if (this.image) {
      this.ctx.drawImage(
        this.image,
        this.imageX, this.imageY,
        this.image.width * this.imageScale,
        this.image.height * this.imageScale
      );
    }
  }

  renderBones() {
    this.ctx.lineWidth = 2;
    this.ctx.strokeStyle = 'rgba(255, 107, 107, 0.6)';

    for (var name in this.joints) {
      var joint = this.joints[name];
      if (!joint.parent) continue;
      var parent = this.joints[joint.parent];
      if (!parent) continue;

      this.ctx.beginPath();
      this.ctx.moveTo(parent.x, parent.y);
      this.ctx.lineTo(joint.x, joint.y);
      this.ctx.stroke();
    }
  }

  renderJoints() {
    for (var name in this.joints) {
      var joint = this.joints[name];

      this.ctx.beginPath();
      this.ctx.arc(joint.x, joint.y, this.jointRadius, 0, Math.PI * 2);

      if (name === 'head') {
        this.ctx.fillStyle = 'rgba(255, 200, 50, 0.9)';
      } else if (name.indexOf('arm') === 0) {
        this.ctx.fillStyle = 'rgba(100, 200, 255, 0.9)';
      } else if (name.indexOf('leg') === 0) {
        this.ctx.fillStyle = 'rgba(100, 255, 150, 0.9)';
      } else {
        this.ctx.fillStyle = 'rgba(255, 100, 100, 0.9)';
      }

      this.ctx.fill();
      this.ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();

      this.ctx.fillStyle = '#fff';
      this.ctx.font = 'bold 10px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(name, joint.x, joint.y + 3);
    }
  }

  handleMouseDown(e) {
    if (this.step !== 4 || this.isPreviewing) return;
    var rect = this.canvas.getBoundingClientRect();
    var mx = e.clientX - rect.left;
    var my = e.clientY - rect.top;

    for (var name in this.joints) {
      var dx = mx - this.joints[name].x;
      var dy = my - this.joints[name].y;
      if (Math.sqrt(dx * dx + dy * dy) < this.jointRadius + 5) {
        this.draggingJoint = name;
        return;
      }
    }
  }

  handleMouseMove(e) {
    if (!this.draggingJoint || this.isPreviewing) return;
    var rect = this.canvas.getBoundingClientRect();
    this.joints[this.draggingJoint].x = e.clientX - rect.left;
    this.joints[this.draggingJoint].y = e.clientY - rect.top;
    this.render();
  }

  handleMouseUp(e) {
    if (this.draggingJoint) {
      this.updateStatus('关节 ' + this.draggingJoint + ' 已更新');
      this.draggingJoint = null;
    }
  }

  _loadPetBinding(pet) {
    var binding = pet.characterBinding;
    if (!binding) return;

    this.selectedModuleId = pet.moduleData.id;
    this.moduleData = pet.moduleData;

    var rootJoint = binding.joints.root;
    var rootX = rootJoint ? rootJoint.x : 0;
    var rootY = rootJoint ? rootJoint.y : 0;

    this.joints = {};
    for (var name in binding.joints) {
      this.joints[name] = {
        x: binding.joints[name].x,
        y: binding.joints[name].y,
        parent: binding.joints[name].parent || null
      };
    }

    var img = new Image();
    var self = this;
    img.onload = function() {
      self.image = img;
      self.imageX = binding.imageX || 0;
      self.imageY = binding.imageY || 0;
      self.imageScale = binding.imageScale || 1;
      self.fitImageToCanvas();
      self.updateStatus('已加载角色「' + pet.name + '」的绑定数据');
      self.render();
    };
    img.src = binding.imageDataUrl;
  }

  handleWheel(e) {
    if (this.step < 3 || this.step > 6 || !this.image) return;
    var delta = e.deltaY > 0 ? -0.05 : 0.05;
    var newScale = Math.max(0.1, Math.min(3, this.imageScale + delta));
    if (newScale !== this.imageScale) {
      var cx = this.imageX + this.image.width * this.imageScale / 2;
      var cy = this.imageY + this.image.height * this.imageScale / 2;
      this.imageScale = newScale;
      this.imageX = cx - this.image.width * newScale / 2;
      this.imageY = cy - this.image.height * newScale / 2;
      this.render();
    }
  }

  save() {
    if (!this.characterName) {
      alert('请输入角色名称');
      return;
    }
    if (!this.moduleData) {
      alert('请选择动作模组');
      return;
    }
    if (!this.image) {
      alert('请导入PNG图片');
      return;
    }

    var jointData = {};
    for (var name in this.joints) {
      jointData[name] = {
        x: this.joints[name].x,
        y: this.joints[name].y,
        angle: 0,
        parent: this.joints[name].parent
      };
    }

    var tmpCanvas = document.createElement('canvas');
    tmpCanvas.width = this.image.width;
    tmpCanvas.height = this.image.height;
    var tmpCtx = tmpCanvas.getContext('2d');
    tmpCtx.drawImage(this.image, 0, 0);
    var thumbnail = tmpCanvas.toDataURL('image/png', 0.3);

    var binding = {
      imageDataUrl: this.image.src,
      imageWidth: this.image.width,
      imageHeight: this.image.height,
      imageScale: this.imageScale,
      imageX: this.imageX,
      imageY: this.imageY,
      joints: jointData,
      thumbnail: thumbnail
    };

    var result = {
      characterName: this.characterName,
      moduleId: this.selectedModuleId,
      binding: binding
    };

    this.updateStatus('角色配置已保存');
    if (this.onSave) {
      this.onSave(result);
    }
  }

  clearCanvas() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  updateStatus(text) {
    var status = document.getElementById('editor-status');
    if (status) {
      status.textContent = text;
      status.style.color = '#333';
    }
  }

  handleResize() {
    if (this.image) {
      this.fitImageToCanvas();
      this.render();
    }
  }
}