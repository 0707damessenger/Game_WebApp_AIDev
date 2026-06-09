class PetInstance {
  constructor(name, moduleData, x, y, characterBinding) {
    this.name = name;
    this.x = x;
    this.y = y;
    this.scale = 1.0;
    this.visible = true;

    this.moduleData = moduleData;
    this.characterBinding = characterBinding || null;

    var jointsData = {};
    var localImgX = 0;
    var localImgY = 0;
    var localImgScale = 1;

    if (characterBinding && characterBinding.joints) {
      var rootJoint = characterBinding.joints.root;
      var rootX = rootJoint ? rootJoint.x : 0;
      var rootY = rootJoint ? rootJoint.y : 0;

      var shifted = {};
      for (var name in characterBinding.joints) {
        shifted[name] = {
          x: characterBinding.joints[name].x - rootX,
          y: characterBinding.joints[name].y - rootY
        };
      }

      for (var name in characterBinding.joints) {
        var joint = characterBinding.joints[name];
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

      localImgX = (characterBinding.imageX || 0) - rootX;
      localImgY = (characterBinding.imageY || 0) - rootY;
      localImgScale = characterBinding.imageScale || 1;
    } else {
      jointsData = moduleData.skeleton.joints;
    }

    this.skeleton = new Skeleton(jointsData);
    this.renderer = new PetRenderer(this.skeleton);
    this.animationPlayer = new AnimationPlayer(moduleData.animations);

    if (characterBinding && characterBinding.imageDataUrl) {
      this._loadCharacterImage(characterBinding.imageDataUrl, localImgX, localImgY, localImgScale);
    }

    this.onStateChange = null;
    this.stateMachine = new StateMachine(
      moduleData.stateMachine,
      this.handleStateChange.bind(this)
    );
    this.stateMachine.start();
  }

  _loadCharacterImage(dataUrl, imgX, imgY, imgScale) {
    var self = this;
    var img = new Image();
    img.onload = function() {
      self.renderer.setImage(img, imgX, imgY, imgScale);
    };
    img.src = dataUrl;
  }

  handleStateChange(data) {
    this.animationPlayer.play(data.animation);

    if (data.isOneShot) {
      var self = this;
      this.animationPlayer.onAnimationEnd = function() {
        self.animationPlayer.onAnimationEnd = null;
        self.stateMachine.handleEvent('animationEnd');
      };
    }

    if (this.onStateChange) {
      this.onStateChange(data);
    }
  }

  update(deltaTime) {
    var jointAngles = this.animationPlayer.update(deltaTime);
    this.skeleton.updateJoints(jointAngles);
  }

  render(ctx) {
    if (!this.visible) return;
    this.renderer.draw(ctx, this.x, this.y, this.scale);
  }

  containsPoint(px, py) {
    var dx = px - this.x;
    var dy = py - this.y;
    var baseRadius = (CONFIG.interaction && CONFIG.interaction.hitRadius) || 50;
    var radius = baseRadius * (this.scale || 1);
    return Math.sqrt(dx * dx + dy * dy) < radius;
  }

  sendEvent(event) {
    this.stateMachine.handleEvent(event);
  }

  transition(state) {
    this.stateMachine.transition(state);
  }

  toSaveData() {
    return {
      name: this.name,
      x: this.x,
      y: this.y,
      moduleId: this.moduleData.id,
      characterBinding: this.characterBinding
    };
  }
}

class PetManager {
  constructor() {
    this.pets = [];
    this.activeIndex = 0;
    this.nextId = 1;
  }

  addPet(name, moduleId, x, y, characterBinding) {
    var mod = getModuleById(moduleId);
    var pet = new PetInstance(
      name || ('角色 ' + this.nextId),
      mod,
      x || (200 + Math.random() * 400),
      y || (200 + Math.random() * 300),
      characterBinding
    );
    this.pets.push(pet);
    this.nextId++;
    return pet;
  }

  addPetFromSave(saveData) {
    var mod = getModuleById(saveData.moduleId);
    var pet = new PetInstance(
      saveData.name,
      mod,
      saveData.x || 300,
      saveData.y || 300,
      saveData.characterBinding
    );
    pet.id = saveData.id;
    this.pets.push(pet);
    return pet;
  }

  removePet(index) {
    if (index < 0 || index >= this.pets.length) return;
    this.pets[index].stateMachine.stop();
    this.pets.splice(index, 1);
    if (this.activeIndex >= this.pets.length) {
      this.activeIndex = Math.max(0, this.pets.length - 1);
    }
  }

  getActivePet() {
    return this.pets[this.activeIndex] || null;
  }

  setActive(index) {
    if (index >= 0 && index < this.pets.length) {
      this.activeIndex = index;
    }
  }

  getPetAtPoint(x, y) {
    for (var i = this.pets.length - 1; i >= 0; i--) {
      if (this.pets[i].containsPoint(x, y)) {
        return { pet: this.pets[i], index: i };
      }
    }
    return null;
  }

  updateAll(deltaTime) {
    for (var i = 0; i < this.pets.length; i++) {
      this.pets[i].update(deltaTime);
    }
  }

  renderAll(ctx) {
    for (var i = 0; i < this.pets.length; i++) {
      this.pets[i].render(ctx);
    }
  }

  getPetList() {
    var self = this;
    return this.pets.map(function(pet, index) {
      return {
        name: pet.name,
        index: index,
        isActive: index === self.activeIndex
      };
    });
  }

  clear() {
    for (var i = 0; i < this.pets.length; i++) {
      this.pets[i].stateMachine.stop();
    }
    this.pets = [];
    this.activeIndex = 0;
  }
}