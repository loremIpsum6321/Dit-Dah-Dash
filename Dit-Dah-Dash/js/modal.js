/**
 * js/modal.js
 * -----------
 * Handles basic modal functionality including showing, hiding,
 * and simple drag-and-drop for the modal window. Fixes drag start jump.
 */

class Modal {
    /**
     * Initializes the Modal instance.
     * @param {string} modalId - The ID of the modal container element.
     * @param {string} openButtonId - The ID of the button that opens the modal.
     * @param {string} closeButtonId - The ID of the button that closes the modal.
     * @param {string} headerId - The ID of the modal header element (for dragging).
     * @param {function} [onOpen] - Optional callback when modal opens.
     * @param {function} [onClose] - Optional callback when modal closes.
     */
    constructor(modalId, openButtonId, closeButtonId, headerId, onOpen, onClose) {
        this.modalElement = document.getElementById(modalId);
        this.openButton = document.getElementById(openButtonId);
        this.closeButton = document.getElementById(closeButtonId);
        this.headerElement = document.getElementById(headerId);
        this.onOpen = onOpen;
        this.onClose = onClose;

        this.isDragging = false;
        // Use startX/startY relative to viewport for calculations
        this.startX = 0;
        this.startY = 0;
        // Store initial offset from top-left corner of modal to mouse pointer
        this.offsetX = 0;
        this.offsetY = 0;

        if (!this.modalElement || !this.openButton || !this.closeButton || !this.headerElement) {
            console.error("Modal initialization failed: One or more elements not found.");
            return;
        }

        this._bindEvents();
        this._setInitialPosition();
    }

    /**
     * Binds necessary event listeners for opening, closing, and dragging.
     * @private
     */
    _bindEvents() {
        this.openButton.addEventListener('click', this.open.bind(this));
        this.closeButton.addEventListener('click', this.close.bind(this));
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !this.modalElement.classList.contains('hidden')) {
                this.close();
            }
        });

        // Drag events
        this.headerElement.addEventListener('mousedown', this._dragStart.bind(this));
        document.addEventListener('mousemove', this._drag.bind(this));
        document.addEventListener('mouseup', this._dragEnd.bind(this));

        // Touch events
        this.headerElement.addEventListener('touchstart', this._dragStart.bind(this), { passive: false });
        document.addEventListener('touchmove', this._drag.bind(this), { passive: false });
        document.addEventListener('touchend', this._dragEnd.bind(this));
    }

     /**
     * Sets the initial position (centered) if not already set.
     * @private
     */
     _setInitialPosition() {
         // Only apply transform if position is not explicitly set
         if (!this.modalElement.style.top && !this.modalElement.style.left) {
            this.modalElement.style.left = '50%';
            this.modalElement.style.top = '50%';
            this.modalElement.style.transform = 'translate(-50%, -50%)';
         } else {
            // Ensure transform is cleared if position was set by dragging
             this.modalElement.style.transform = '';
         }
     }

    /**
     * Opens the modal.
     */
    open() {
        this.modalElement.classList.remove('hidden');
        this._setInitialPosition(); // Recenter or ensure position on open
        if (this.onOpen) {
            this.onOpen();
        }
        console.log("Modal opened");
    }

    /**
     * Closes the modal.
     */
    close() {
        this.modalElement.classList.add('hidden');
        if (this.onClose) {
            this.onClose();
        }
        console.log("Modal closed");
    }

    /**
     * Handles the start of a drag operation (mousedown/touchstart).
     * @param {Event} e - The event object.
     * @private
     */
    _dragStart(e) {
        if (!(e.target === this.headerElement || this.headerElement.contains(e.target))) {
            return; // Only drag by header
        }

        // Remove transform before getting position to avoid jump
        this.modalElement.style.transform = '';
        const rect = this.modalElement.getBoundingClientRect();

        let pointerX, pointerY;
        if (e.type === "touchstart") {
            if (e.touches.length !== 1) return; // Only single touch drags
            pointerX = e.touches[0].clientX;
            pointerY = e.touches[0].clientY;
            e.preventDefault(); // Prevent page scroll
        } else {
            pointerX = e.clientX;
            pointerY = e.clientY;
        }

        // Calculate offset from modal's top-left to the pointer
        this.offsetX = pointerX - rect.left;
        this.offsetY = pointerY - rect.top;

        // Set initial position directly using style.left/top
        this.modalElement.style.left = `${rect.left}px`;
        this.modalElement.style.top = `${rect.top}px`;

        this.isDragging = true;
        this.modalElement.style.cursor = 'grabbing';
        this.headerElement.style.cursor = 'grabbing'; // Apply to header too
    }

    /**
     * Handles the drag movement (mousemove/touchmove).
     * @param {Event} e - The event object.
     * @private
     */
    _drag(e) {
        if (!this.isDragging) return;

        e.preventDefault(); // Prevent selection/scrolling

        let pointerX, pointerY;
        if (e.type === "touchmove") {
             if (e.touches.length !== 1) { this._dragEnd(e); return; } // End drag if multi-touch
             pointerX = e.touches[0].clientX;
             pointerY = e.touches[0].clientY;
        } else {
            pointerX = e.clientX;
            pointerY = e.clientY;
        }

        // Calculate new top-left corner position
        let newX = pointerX - this.offsetX;
        let newY = pointerY - this.offsetY;

        // Optional: Basic boundary check
        const maxX = window.innerWidth - this.modalElement.offsetWidth;
        const maxY = window.innerHeight - this.modalElement.offsetHeight;
        newX = Math.max(0, Math.min(newX, maxX));
        newY = Math.max(0, Math.min(newY, maxY));

        this._setPosition(newX, newY);
    }

    /**
     * Handles the end of a drag operation (mouseup/touchend).
     * @param {Event} e - The event object.
     * @private
     */
    _dragEnd(e) {
        if (this.isDragging) {
             this.isDragging = false;
             this.modalElement.style.cursor = ''; // Reset cursor
             this.headerElement.style.cursor = 'move'; // Reset header cursor
             // Keep position set by style.left/top, don't re-apply transform
         }
    }

    /**
     * Sets the position of the modal element using left/top.
     * @param {number} xPos - The target X coordinate (px).
     * @param {number} yPos - The target Y coordinate (px).
     * @private
     */
    _setPosition(xPos, yPos) {
        this.modalElement.style.left = `${xPos}px`;
        this.modalElement.style.top = `${yPos}px`;
    }
}