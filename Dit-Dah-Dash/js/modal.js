/* In file: js/modal.js */
/**
 * js/modal.js ++
 * -----------
 * Handles basic modal functionality including showing, hiding,
 * and simple drag-and-drop for the modal window.
 * Refines drag start logic for smoother interaction.
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
        // Store initial offset from top-left corner of modal to mouse pointer
        this.offsetX = 0;
        this.offsetY = 0;
        // Store initial modal position to avoid recalculating bounds constantly
        this.initialModalX = 0;
        this.initialModalY = 0;

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
        // Prevent mouse drag interfering with text selection inside modal
        this.modalElement.addEventListener('mousedown', (e) => {
             if (e.target !== this.headerElement && !this.headerElement.contains(e.target)) {
                 e.stopPropagation(); // Prevent drag start if clicking inside content
             }
        });


        // Touch events
        this.headerElement.addEventListener('touchstart', this._dragStart.bind(this), { passive: false });
        document.addEventListener('touchmove', this._drag.bind(this), { passive: false });
        document.addEventListener('touchend', this._dragEnd.bind(this));
    }

     /**
     * Sets the initial position (centered) if not already set by dragging.
     * Ensures transform is cleared if position was set manually.
     * @private
     */
     _setInitialPosition() {
         // Only center using transform if left/top are not set by dragging
         if (!this.modalElement.style.left && !this.modalElement.style.top) {
            this.modalElement.style.left = '50%';
            this.modalElement.style.top = '50%';
            this.modalElement.style.transform = 'translate(-50%, -50%)';
         } else {
             // If left/top *are* set (likely by dragging), ensure transform is removed
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
     * Uses pageX/pageY for more robust offset calculation.
     * @param {Event} e - The event object.
     * @private
     */
    _dragStart(e) {
        // Ensure drag starts only on the header itself
        if (!(e.target === this.headerElement || this.headerElement.contains(e.target))) {
            return;
        }

        this.isDragging = true;
        this.modalElement.style.cursor = 'grabbing';
        this.headerElement.style.cursor = 'grabbing';

        let pointerX, pointerY;
        if (e.type === "touchstart") {
            if (e.touches.length !== 1) {
                this._dragEnd(e); return;
            }
            pointerX = e.touches[0].pageX; // Use pageX for touch
            pointerY = e.touches[0].pageY; // Use pageY for touch
            e.preventDefault(); // Prevent page scroll only during touch drag
        } else {
            pointerX = e.pageX; // Use pageX for mouse
            pointerY = e.pageY; // Use pageY for mouse
        }

        // --- Refined Offset Calculation ---
        // Remove transform to work with pixel values
        this.modalElement.style.transform = '';

        // Get the current pixel position
        const rect = this.modalElement.getBoundingClientRect();
        // Convert viewport-relative rect.left/top to document-relative positions
        this.initialModalX = rect.left + window.scrollX;
        this.initialModalY = rect.top + window.scrollY;

        // Calculate offset from the modal's document-relative top-left corner to the pointer
        this.offsetX = pointerX - this.initialModalX;
        this.offsetY = pointerY - this.initialModalY;

        // Set position explicitly using pixels to fix the jump
        this.modalElement.style.left = `${this.initialModalX}px`;
        this.modalElement.style.top = `${this.initialModalY}px`;
        // --- End Refinement ---
    }


    /**
     * Handles the drag movement (mousemove/touchmove).
     * @param {Event} e - The event object.
     * @private
     */
    _drag(e) {
        if (!this.isDragging) return;

        // Prevent default actions like text selection during mouse drag
        if (e.type === "mousemove") {
            e.preventDefault();
        }

        let pointerX, pointerY;
        if (e.type === "touchmove") {
             if (e.touches.length !== 1) {
                 this._dragEnd(e); return;
             }
             pointerX = e.touches[0].pageX; // Use pageX for touch
             pointerY = e.touches[0].pageY; // Use pageY for touch
             // preventDefault is handled in dragStart for touch
        } else {
            pointerX = e.pageX; // Use pageX for mouse
            pointerY = e.pageY; // Use pageY for mouse
        }

        // Calculate new top-left corner position based on pointer and initial offset
        let newX = pointerX - this.offsetX;
        let newY = pointerY - this.offsetY;

        // Basic boundary check relative to viewport size and scroll position
        const modalWidth = this.modalElement.offsetWidth;
        const modalHeight = this.modalElement.offsetHeight;
        const minX = window.scrollX;
        const minY = window.scrollY;
        const maxX = window.innerWidth + window.scrollX - modalWidth;
        const maxY = window.innerHeight + window.scrollY - modalHeight;

        newX = Math.max(minX, Math.min(newX, maxX));
        newY = Math.max(minY, Math.min(newY, maxY));

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
         }
    }

    /**
     * Sets the position of the modal element using left/top styles.
     * @param {number} xPos - The target X coordinate (px).
     * @param {number} yPos - The target Y coordinate (px).
     * @private
     */
    _setPosition(xPos, yPos) {
        this.modalElement.style.left = `${xPos}px`;
        this.modalElement.style.top = `${yPos}px`;
    }
}