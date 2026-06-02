class StateMachine {
  constructor(config, onStateChange) {
    this.config = config;
    this.onStateChange = onStateChange;
    this.currentState = config.initialState;
    this.stateTime = 0;
    this.timers = [];
    this.locked = false;
  }

  start() {
    this.stateTime = 0;
    this.setupTimers();
    this.emitStateChange();
  }

  transition(toState) {
    if (this.locked) return;

    const state = this.config.states[toState];
    if (!state) {
      console.warn('StateMachine: unknown state', toState);
      return;
    }

    this.clearTimers();
    this.currentState = toState;
    this.stateTime = 0;
    this.setupTimers();
    this.emitStateChange();
  }

  emitStateChange() {
    if (this.onStateChange) {
      const state = this.config.states[this.currentState];
      this.onStateChange({
        state: this.currentState,
        animation: state.animation,
        bubble: state.bubble || null,
        isOneShot: state.oneShot || false,
        onEndState: state.onEnd || null
      });
    }
  }

  setupTimers() {
    const state = this.config.states[this.currentState];
    if (!state.timers) return;

    for (const timer of state.timers) {
      const id = setTimeout(() => {
        if (Math.random() < timer.chance) {
          this.transition(timer.to);
        }
      }, timer.after);
      this.timers.push(id);
    }
  }

  clearTimers() {
    for (const id of this.timers) {
      clearTimeout(id);
    }
    this.timers = [];
  }

  handleEvent(event) {
    switch (event) {
      case 'click':
        this.transition('clickHappy');
        break;
      case 'dragStart':
        this.transition('dragWalk');
        break;
      case 'dragEnd':
        this.transition('idle');
        break;
      case 'animationEnd':
        this.handleAnimationEnd();
        break;
    }
  }

  handleAnimationEnd() {
    const state = this.config.states[this.currentState];
    if (state.oneShot && state.onEnd) {
      this.transition(state.onEnd);
    }
  }

  lock() {
    this.locked = true;
  }

  unlock() {
    this.locked = false;
  }

  stop() {
    this.clearTimers();
  }
}