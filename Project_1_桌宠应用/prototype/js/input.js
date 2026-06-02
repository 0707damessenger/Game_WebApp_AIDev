class InputHandler {
  constructor(config, canvas, onDrag, onClick, onRightClick, onHover, isEditorModeFn) {
    this.config = config;
    this.canvas = canvas;
    this.onDrag = onDrag;
    this.onClick = onClick;
    this.onRightClick = onRightClick;
    this.onHover = onHover;
    this.isEditorModeFn = isEditorModeFn || (() => false);
    
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.lastMouseX = 0;
    this.lastMouseY = 0;
    this.clickTimer = null;
    this.isHovering = false;
    
    this.setupEventListeners();
  }

  setupEventListeners() {
    this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
    this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
    this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
    this.canvas.addEventListener('mouseleave', this.handleMouseLeave.bind(this));
    this.canvas.addEventListener('contextmenu', this.handleContextMenu.bind(this));
    
    document.addEventListener('mousemove', this.handleGlobalMouseMove.bind(this));
  }

  handleMouseDown(e) {
    if (this.isEditorModeFn()) return;
    if (e.button !== 0) return;
    
    this.isDragging = false;
    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;
    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;
    
    this.clickTimer = setTimeout(() => {
      this.clickTimer = null;
    }, this.config.interaction.clickDelay);
  }

  handleMouseMove(e) {
    if (this.isEditorModeFn()) return;

    if (!this.isDragging && this.clickTimer) {
      const dx = Math.abs(e.clientX - this.dragStartX);
      const dy = Math.abs(e.clientY - this.dragStartY);
      
      if (dx > this.config.interaction.dragThreshold || dy > this.config.interaction.dragThreshold) {
        clearTimeout(this.clickTimer);
        this.clickTimer = null;
        this.isDragging = true;
        
        if (this.onDrag) {
          this.onDrag('start', e.clientX, e.clientY);
        }
      }
    }
    
    if (this.isDragging && this.onDrag) {
      this.onDrag('move', e.clientX, e.clientY);
    }
    
    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;
  }

  handleMouseUp(e) {
    if (this.isEditorModeFn()) return;
    if (e.button !== 0) return;
    
    if (this.clickTimer) {
      clearTimeout(this.clickTimer);
      this.clickTimer = null;
      
      if (this.onClick) {
        this.onClick(e.clientX, e.clientY);
      }
    }
    
    if (this.isDragging && this.onDrag) {
      this.onDrag('end', e.clientX, e.clientY);
    }
    
    this.isDragging = false;
  }

  handleMouseLeave() {
    if (this.isEditorModeFn()) return;

    if (this.clickTimer) {
      clearTimeout(this.clickTimer);
      this.clickTimer = null;
    }
    
    if (this.isDragging && this.onDrag) {
      this.onDrag('end', this.lastMouseX, this.lastMouseY);
    }
    
    this.isDragging = false;
    
    if (this.isHovering && this.onHover) {
      this.onHover(false);
    }
    this.isHovering = false;
  }

  handleContextMenu(e) {
    if (this.isEditorModeFn()) return;
    e.preventDefault();
    
    if (this.onRightClick) {
      this.onRightClick(e.clientX, e.clientY);
    }
  }

  handleGlobalMouseMove(e) {
    if (this.isEditorModeFn()) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const isOverCanvas = x >= 0 && x < this.canvas.width && y >= 0 && y < this.canvas.height;
    
    if (isOverCanvas !== this.isHovering && this.onHover) {
      this.onHover(isOverCanvas, e.clientX, e.clientY);
      this.isHovering = isOverCanvas;
    }
  }

  getMousePosition(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }
}