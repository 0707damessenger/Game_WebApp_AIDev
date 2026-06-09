class PetApp {
  constructor() {
    this.canvas = document.getElementById('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.bubble = document.getElementById('bubble');
    this.menu = document.getElementById('menu');

    this.config = CONFIG;
    this.isVisible = true;
    this.isEditorMode = false;

    this.petManager = new PetManager();
    this.aiChat = new AIChat(this.config);

    this.lastTime = performance.now();
    this.animationFrameId = null;

    this.setupEditor();
    this.setupCharacterPanel();
    this.setupAI();
    this.setupChat();
    this.setupInput();
    this.setupMenu();
    this.resizeCanvas();
    this.loadFromStorage();
    if (this.petManager.pets.length === 0) {
      this.petManager.addPet('默认角色', getDefaultModule().id, this.config.pet.defaultX, this.config.pet.defaultY);
      this.saveToStorage();
    }
    this.startLoop();
  }

  get activePet() {
    return this.petManager.getActivePet();
  }

  setupEditor() {
    this.editor = new SkeletonEditor(
      this.canvas,
      this.handleEditorSave.bind(this),
      this.handleEditorClose.bind(this)
    );

    this.editorPanel = document.getElementById('editor-panel');

    document.getElementById('editor-btn').addEventListener('click', function(e) {
      e.stopPropagation();
      this.enterEditorMode();
    }.bind(this));

    document.getElementById('editor-next').addEventListener('click', function() {
      this.editor.nextStep();
    }.bind(this));

    document.getElementById('editor-prev').addEventListener('click', function() {
      this.editor.prevStep();
    }.bind(this));

    document.getElementById('editor-cancel').addEventListener('click', function() {
      this.exitEditorMode();
    }.bind(this));

    var self = this;
    document.getElementById('editor-file').addEventListener('change', function(e) {
      if (e.target.files[0]) {
        self.editor.loadImage(e.target.files[0]);
      }
    });
  }

  setupAI() {
    this.aiPanel = document.getElementById('ai-panel');

    document.getElementById('ai-btn').addEventListener('click', function(e) {
      e.stopPropagation();
      this.toggleAIPanel();
    }.bind(this));

    document.getElementById('ai-close').addEventListener('click', function() {
      this.aiPanel.style.display = 'none';
    }.bind(this));

    var self = this;
    document.getElementById('ai-save-config').addEventListener('click', function() {
      self.aiChat.setEndpoint(document.getElementById('ai-endpoint').value);
      self.aiChat.setApiKey(document.getElementById('ai-key').value);
      self.aiChat.setModel(document.getElementById('ai-model').value);
      self.aiChat.setSystemPrompt(document.getElementById('ai-prompt').value);
      self.aiPanel.style.display = 'none';
      self.showBubble('AI配置已保存');
      self.saveToStorage();
    });
  }

  toggleAIPanel() {
    var isOpen = this.aiPanel.style.display === 'block';
    this.aiPanel.style.display = isOpen ? 'none' : 'block';
    if (!isOpen) {
      var cfg = this.aiChat.getConfig();
      document.getElementById('ai-endpoint').value = cfg.endpoint;
      document.getElementById('ai-key').value = '';
      document.getElementById('ai-model').value = cfg.model;
      document.getElementById('ai-prompt').value = cfg.systemPrompt;
    }
  }

  setupChat() {
    this.chatDialog = document.getElementById('chat-dialog');
    this.chatMessages = document.getElementById('chat-messages');
    this.chatInput = document.getElementById('chat-input');

    var self = this;
    document.getElementById('chat-close').addEventListener('click', function() {
      self.chatDialog.style.display = 'none';
    });

    document.getElementById('chat-send').addEventListener('click', function() {
      self.sendChatMessage();
    });

    document.getElementById('chat-input').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        self.sendChatMessage();
      }
    });
  }

  openChat() {
    this.chatDialog.style.display = 'block';
    this.chatInput.focus();
  }

  async sendChatMessage() {
    var text = this.chatInput.value.trim();
    if (!text) return;

    this.chatInput.value = '';
    this.addChatMessage('user', text);

    var reply = await this.aiChat.sendMessage(text);

    if (reply.error) {
      this.addChatMessage('error', reply.error);
    } else if (reply.content) {
      this.addChatMessage('assistant', reply.content);
      this.showBubble(reply.content.substring(0, 50) + '...');
    }
  }

  addChatMessage(role, text) {
    var div = document.createElement('div');
    div.style.marginBottom = '8px';
    div.style.padding = '8px 12px';
    div.style.borderRadius = '12px';
    div.style.maxWidth = '80%';
    div.style.fontSize = '13px';

    if (role === 'user') {
      div.style.background = '#4A90D9';
      div.style.color = 'white';
      div.style.marginLeft = 'auto';
      div.style.textAlign = 'right';
    } else if (role === 'assistant') {
      div.style.background = '#f0f0f0';
      div.style.color = '#333';
      div.style.marginRight = 'auto';
    } else {
      div.style.background = '#ffe0e0';
      div.style.color = '#e74c3c';
      div.style.marginRight = 'auto';
    }

    div.textContent = text;
    this.chatMessages.appendChild(div);
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  }

  setupCharacterPanel() {
    this.charPanel = document.getElementById('char-panel');

    var self = this;
    document.getElementById('char-list-btn').addEventListener('click', function(e) {
      e.stopPropagation();
      self.toggleCharPanel();
    });

    document.getElementById('char-add').addEventListener('click', function() {
      var name = prompt('请输入角色名称：');
      if (name && name.trim()) {
        self.petManager.addPet(name.trim(), getDefaultModule().id);
        self.renderCharList();
        self.saveToStorage();
      }
    });
  }

  toggleCharPanel() {
    var isOpen = this.charPanel.style.display === 'block';
    this.charPanel.style.display = isOpen ? 'none' : 'block';
    if (!isOpen) {
      this.renderCharList();
    }
  }

  renderCharList() {
    var container = document.getElementById('char-list-content');
    var list = this.petManager.getPetList();

    container.innerHTML = list.map(function(pet) {
      var activeClass = pet.isActive ? 'style="background:#e8f4fd; border-radius:6px;"' : '';
      var indicator = pet.isActive ? ' ●' : '';
      return '<div ' + activeClass + ' style="display:flex; align-items:center; justify-content:space-between; padding:6px 8px; margin-bottom:4px;">' +
        '<span class="char-name" data-index="' + pet.index + '" style="font-size:13px;cursor:pointer;">' + pet.name + indicator + '</span>' +
        '<div style="display:flex;gap:2px;">' +
        '<button class="char-switch" data-index="' + pet.index + '" style="font-size:11px; padding:3px 6px; border:1px solid #4A90D9; border-radius:6px; background:white; color:#4A90D9; cursor:pointer;">切换</button>' +
        '<button class="char-rename" data-index="' + pet.index + '" style="font-size:11px; padding:3px 6px; border:1px solid #f39c12; border-radius:6px; background:white; color:#f39c12; cursor:pointer;">重命名</button>' +
        '<button class="char-copy" data-index="' + pet.index + '" style="font-size:11px; padding:3px 6px; border:1px solid #764ba2; border-radius:6px; background:white; color:#764ba2; cursor:pointer;">复制</button>' +
        '<button class="char-delete" data-index="' + pet.index + '" style="font-size:11px; padding:3px 6px; border:1px solid #e74c3c; border-radius:6px; background:white; color:#e74c3c; cursor:pointer;">删除</button>' +
        '</div>' +
        '</div>';
    }).join('');

    var self = this;

    container.querySelectorAll('.char-name').forEach(function(el) {
      el.addEventListener('click', function() {
        var idx = parseInt(this.dataset.index);
        self.petManager.setActive(idx);
        self.renderCharList();
      });
    });

    container.querySelectorAll('.char-switch').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var idx = parseInt(this.dataset.index);
        self.petManager.setActive(idx);
        self.renderCharList();
      });
    });

    container.querySelectorAll('.char-rename').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var idx = parseInt(this.dataset.index);
        var pet = self.petManager.pets[idx];
        if (!pet) return;
        var newName = prompt('重命名角色：', pet.name);
        if (newName && newName.trim()) {
          pet.name = newName.trim();
          self.renderCharList();
          self.saveToStorage();
        }
      });
    });

    container.querySelectorAll('.char-copy').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var idx = parseInt(this.dataset.index);
        var pet = self.petManager.pets[idx];
        if (!pet) return;
        var saveData = pet.toSaveData();
        saveData.name = saveData.name + '(副本)';
        saveData.x = (saveData.x || 300) + 50;
        saveData.y = (saveData.y || 300) + 50;
        self.petManager.addPetFromSave(saveData);
        self.renderCharList();
        self.saveToStorage();
      });
    });

    container.querySelectorAll('.char-delete').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var idx = parseInt(this.dataset.index);
        self.petManager.removePet(idx);
        self.renderCharList();
        self.saveToStorage();
      });
    });
  }

  enterEditorMode() {
    this.isEditorMode = true;
    this.editorPanel.style.display = 'block';
    this.charPanel.style.display = 'none';
    this.canvas.style.cursor = 'default';

    var active = this.activePet;
    var existingBinding = null;
    if (active && active.characterBinding) {
      existingBinding = { pet: active, petIndex: this.petManager.activeIndex };
    }
    this.editor.enter(existingBinding);
  }

  exitEditorMode() {
    this.isEditorMode = false;
    this.editor.isPreviewing = false;
    this.editor.stopPreview();
    this.editorPanel.style.display = 'none';
    this.canvas.style.cursor = 'grab';
    this.render();
  }

  handleEditorSave(data) {
    if (!data || !data.characterName || !data.moduleId) return;

    var editedPet = this.editor._editingPet;
    if (editedPet && this.petManager.pets.indexOf(editedPet) >= 0) {
      var mod = getModuleById(data.moduleId);
      editedPet.name = data.characterName;
      editedPet.moduleData = mod;
      editedPet.characterBinding = data.binding;

      var rootJoint = data.binding.joints.root;
      var rootX = rootJoint ? rootJoint.x : 0;
      var rootY = rootJoint ? rootJoint.y : 0;

      var shifted = {};
      for (var name in data.binding.joints) {
        shifted[name] = { x: data.binding.joints[name].x - rootX, y: data.binding.joints[name].y - rootY };
      }

      var jointsData = {};
      for (var name in data.binding.joints) {
        var joint = data.binding.joints[name];
        var parentName = joint.parent;
        var px = 0, py = 0;
        if (parentName && shifted[parentName]) {
          px = shifted[parentName].x;
          py = shifted[parentName].y;
        }
        jointsData[name] = {
          x: shifted[name].x - px,
          y: shifted[name].y - py,
          angle: joint.angle || 0,
          parent: parentName || null
        };
      }

      editedPet.skeleton = new Skeleton(jointsData);
      var img = new Image();
      var self = this;
      img.onload = function() {
        editedPet.renderer = new PetRenderer(editedPet.skeleton);
        editedPet.renderer.setImage(img,
          (data.binding.imageX || 0) - rootX,
          (data.binding.imageY || 0) - rootY,
          data.binding.imageScale || 1);
        editedPet.animationPlayer = new AnimationPlayer(mod.animations);
        self.showBubble('角色「' + data.characterName + '」已更新！');
      };
      img.src = data.binding.imageDataUrl;
    } else {
      var x = 200 + Math.random() * 400;
      var y = 200 + Math.random() * 300;
      this.petManager.addPet(data.characterName, data.moduleId, x, y, data.binding);
      this.showBubble('角色「' + data.characterName + '」已创建！');
    }

    this.saveToStorage();
    this.exitEditorMode();
  }

  handleEditorClose() {
    this.exitEditorMode();
  }

  setupInput() {
    var self = this;
    this.inputHandler = new InputHandler(
      this.config,
      this.canvas,
      function(action, x, y) { self.handleDrag(action, x, y); },
      function(x, y) { self.handleClick(x, y); },
      function(x, y) { self.handleRightClick(x, y); },
      function(isHovering, mx, my) { self.handleHover(isHovering, mx, my); },
      function() { return self.isEditorMode; }
    );

    this.canvas.addEventListener('mousedown', function(e) {
      if (self.isEditorMode) {
        self.editor.handleMouseDown(e);
      }
    });

    this.canvas.addEventListener('mousemove', function(e) {
      if (self.isEditorMode) {
        self.editor.handleMouseMove(e);
      }
    });

    this.canvas.addEventListener('mouseup', function(e) {
      if (self.isEditorMode) {
        self.editor.handleMouseUp(e);
      }
    });

    window.addEventListener('resize', function() {
      self.resizeCanvas();
      if (self.isEditorMode && self.editor) {
        self.editor.handleResize();
      }
    });

    this.canvas.addEventListener('wheel', function(e) {
      e.preventDefault();
      if (self.isEditorMode) {
        self.editor.handleWheel(e);
      } else {
        var active = self.activePet;
        if (active) {
          var delta = e.deltaY > 0 ? -0.05 : 0.05;
          active.scale = Math.max(0.3, Math.min(3, active.scale + delta));
        }
      }
    });
  }

  setupMenu() {
    var self = this;
    document.getElementById('menu-idle').addEventListener('click', function() {
      if (self.activePet) self.activePet.transition('idle');
      self.hideMenu();
    });

    document.getElementById('menu-walk').addEventListener('click', function() {
      if (self.activePet) self.activePet.transition('walk');
      self.hideMenu();
    });

    document.getElementById('menu-happy').addEventListener('click', function() {
      if (self.activePet) self.activePet.transition('clickHappy');
      self.hideMenu();
    });

    document.getElementById('menu-chat').addEventListener('click', function() {
      self.openChat();
      self.hideMenu();
    });

    document.getElementById('menu-hide').addEventListener('click', function() {
      self.isVisible = false;
      self.hideMenu();
    });

    document.getElementById('menu-show').addEventListener('click', function() {
      self.isVisible = true;
      self.hideMenu();
    });

    document.addEventListener('click', function(e) {
      if (!self.menu.contains(e.target)) {
        self.hideMenu();
      }
    });
  }

  resizeCanvas() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  startLoop() {
    var self = this;
    var loop = function(currentTime) {
      var deltaTime = currentTime - self.lastTime;
      self.lastTime = currentTime;

      if (!self.isEditorMode) {
        self.petManager.updateAll(deltaTime);
        self.render();
      }

      self.animationFrameId = requestAnimationFrame(loop);
    };

    this.lastTime = performance.now();
    this.animationFrameId = requestAnimationFrame(loop);
  }

  update(deltaTime) {
    this.petManager.updateAll(deltaTime);
  }

  render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (!this.isVisible) return;

    this.petManager.renderAll(this.ctx);
  }

  handleDrag(action, x, y) {
    var active = this.activePet;
    if (!active) return;

    if (action === 'start') {
      active.sendEvent('dragStart');
      this.dragOffsetX = x - active.x;
      this.dragOffsetY = y - active.y;
    } else if (action === 'move') {
      active.x = x - this.dragOffsetX;
      active.y = y - this.dragOffsetY;

      active.x = Math.max(50, Math.min(this.canvas.width - 50, active.x));
      active.y = Math.max(50, Math.min(this.canvas.height - 50, active.y));
    } else if (action === 'end') {
      active.sendEvent('dragEnd');
      this.saveToStorage();
    }
  }

  handleClick(x, y) {
    var result = this.petManager.getPetAtPoint(x, y);
    if (result) {
      this.petManager.setActive(result.index);
      result.pet.sendEvent('click');
    }
  }

  handleRightClick(x, y) {
    var result = this.petManager.getPetAtPoint(x, y);
    if (result) {
      this.petManager.setActive(result.index);
    }

    this.menu.style.left = x + 'px';
    this.menu.style.top = y + 'px';
    this.menu.classList.add('show');
  }

  handleHover(isHovering, mouseX, mouseY) {
    if (isHovering && this.isVisible) {
      var result = this.petManager.getPetAtPoint(mouseX, mouseY);
      if (result) {
        var texts = this.config.bubble.hoverTexts;
        var text = texts[Math.floor(Math.random() * texts.length)];
        this.showBubble(text);
      }
    } else {
      this.hideBubble();
    }
  }

  showBubble(text) {
    var active = this.activePet;
    if (!active) return;

    this.bubble.textContent = text;
    this.bubble.style.left = (active.x - this.bubble.offsetWidth / 2) + 'px';
    this.bubble.style.top = (active.y - 80) + 'px';
    this.bubble.style.opacity = '1';

    if (this._bubbleTimer) clearTimeout(this._bubbleTimer);
    this._bubbleTimer = setTimeout(this.hideBubble.bind(this), this.config.bubble.duration);
  }

  hideBubble() {
    this.bubble.style.opacity = '0';
  }

  hideMenu() {
    this.menu.classList.remove('show');
  }

  saveToStorage() {
    try {
      var pets = this.petManager.pets;
      var saveData = pets.map(function(pet, i) {
        var data = pet.toSaveData();
        data.id = i;
        data.activeIndex = this.petManager.activeIndex;
        return data;
      }.bind(this));
      localStorage.setItem('desktop_pet_characters', JSON.stringify(saveData));
      localStorage.setItem('desktop_pet_ai', JSON.stringify(this.aiChat.getConfig()));
    } catch (e) {
      console.warn('存储失败', e);
    }
  }

  loadFromStorage() {
    try {
      var saved = localStorage.getItem('desktop_pet_characters');
      if (saved) {
        var pets = JSON.parse(saved);
        if (pets.length > 0) {
          this.petManager.clear();
          pets.forEach(function(petData) {
            this.petManager.addPetFromSave(petData);
          }.bind(this));
          if (pets[0].activeIndex !== undefined) {
            this.petManager.activeIndex = Math.min(pets[0].activeIndex, this.petManager.pets.length - 1);
          }
        }
      }
      var aiSaved = localStorage.getItem('desktop_pet_ai');
      if (aiSaved) {
        var aiCfg = JSON.parse(aiSaved);
        if (aiCfg.endpoint) this.aiChat.setEndpoint(aiCfg.endpoint);
        if (aiCfg.model) this.aiChat.setModel(aiCfg.model);
        if (aiCfg.systemPrompt) this.aiChat.setSystemPrompt(aiCfg.systemPrompt);
      }
    } catch (e) {
      console.warn('读取存储失败', e);
    }
  }
}

document.addEventListener('DOMContentLoaded', function() {
  window.petApp = new PetApp();
});