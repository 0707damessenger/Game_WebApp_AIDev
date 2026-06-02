class BehaviorController {
  constructor(config, onAction) {
    this.config = config;
    this.onAction = onAction;
    
    this.isIdle = true;
    this.idleTimer = null;
    this.randomActionTimer = null;
    
    this.start();
  }

  start() {
    this.resetIdleTimer();
    this.startRandomActionTimer();
  }

  stop() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    if (this.randomActionTimer) clearInterval(this.randomActionTimer);
  }

  resetIdleTimer() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    
    this.idleTimer = setTimeout(() => {
      this.isIdle = true;
      if (this.onAction) {
        this.onAction('idle');
      }
    }, this.config.behavior.idleTimeout);
  }

  startRandomActionTimer() {
    this.randomActionTimer = setInterval(() => {
      if (this.isIdle && Math.random() < this.config.behavior.randomActionChance) {
        if (this.onAction) {
          this.onAction('random');
        }
      }
    }, 500);
  }

  onInteraction() {
    this.isIdle = false;
    this.resetIdleTimer();
  }

  setIdle(value) {
    this.isIdle = value;
    if (value) {
      this.resetIdleTimer();
    }
  }
}