class AnimationPlayer {
  constructor(animationsData) {
    this.animationsData = animationsData;
    this.currentAnimation = null;
    this.animationTime = 0;
    this.isPlaying = false;
    this.onAnimationEnd = null;
  }

  play(animationName) {
    if (!this.animationsData[animationName]) {
      console.warn('Animation ' + animationName + ' not found');
      return;
    }
    
    this.currentAnimation = this.animationsData[animationName];
    this.animationTime = 0;
    this.isPlaying = true;
  }

  stop() {
    this.isPlaying = false;
    this.currentAnimation = null;
  }

  update(deltaTime) {
    if (!this.isPlaying || !this.currentAnimation) {
      return {};
    }
    
    this.animationTime += deltaTime;
    
    if (this.animationTime >= this.currentAnimation.duration) {
      if (this.currentAnimation.loop) {
        this.animationTime = this.animationTime % this.currentAnimation.duration;
      } else {
        this.isPlaying = false;
        if (this.onAnimationEnd) {
          this.onAnimationEnd();
        }
        return {};
      }
    }
    
    return this.getFrameData();
  }

  getFrameData() {
    if (!this.currentAnimation) return {};
    
    const keyframes = this.currentAnimation.keyframes;
    if (keyframes.length < 2) return {};
    
    let prevKeyframe = keyframes[0];
    let nextKeyframe = keyframes[1];
    
    for (let i = 0; i < keyframes.length - 1; i++) {
      if (this.animationTime >= keyframes[i].t && this.animationTime <= keyframes[i + 1].t) {
        prevKeyframe = keyframes[i];
        nextKeyframe = keyframes[i + 1];
        break;
      }
    }
    
    const t = (this.animationTime - prevKeyframe.t) / (nextKeyframe.t - prevKeyframe.t);
    
    const result = {};
    const allJoints = { ...prevKeyframe.joints, ...nextKeyframe.joints };
    
    for (const jointName of Object.keys(allJoints)) {
      const prevAngle = prevKeyframe.joints[jointName]?.angle || 0;
      const nextAngle = nextKeyframe.joints[jointName]?.angle || 0;
      
      result[jointName] = {
        angle: prevAngle + (nextAngle - prevAngle) * this.easeInOutCubic(t)
      };
    }
    
    return result;
  }

  easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  getCurrentAnimationName() {
    if (!this.currentAnimation) return null;
    for (var name in this.animationsData) {
      if (this.animationsData[name] === this.currentAnimation) return name;
    }
    return null;
  }
}