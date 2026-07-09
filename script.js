document.addEventListener('DOMContentLoaded', () => {
    const jkbxLink = document.getElementById('jkbx-link');
    const jkbxInfoBox = document.getElementById('jkbx-info-box');
    // const blurOverlay = document.getElementById('blur-overlay'); // Get overlay element // Not used

    const redButtonLink = document.getElementById('red-button-link'); // New Red Button

    // Header Logo Info Box elements
    const headerLogoElement = document.getElementById('header-logo');
    const headerLogoInfoBox = document.getElementById('header-logo-info-box');

    // Red Button lava-lamp background
    const redButtonBgCanvas = document.getElementById('red-button-bg-canvas');
    let redButtonLavaController = null;

    // Click Log Message elements
    const clickLogMessageElement = document.getElementById('click-log-message');
    let redButtonClickCount = 0;

    let leaveTimeout; // Variable to hold the timeout ID
    const leaveDelay = 300; // Delay in milliseconds before hiding

    // Touch devices have no hover, so mouseenter/mouseleave-driven info
    // boxes below either never show (icon just navigates away instantly)
    // or never hide. On touch, use tap-to-toggle instead — see
    // setupInfoBoxEventListeners' touch branch.
    const HOVER_CAPABLE = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const touchInfoBoxes = [];
    let hlActivatePixelation = () => {};
    let hlDeactivatePixelation = () => {};

    function closeTouchInfoBox(triggerElement, infoBoxElement, onClose) {
        infoBoxElement.classList.remove('visible');
        if (onClose) onClose();
    }

    function closeTouchInfoBoxesExcept(exceptTrigger) {
        touchInfoBoxes.forEach(({ trigger, box, onClose }) => {
            if (trigger !== exceptTrigger) closeTouchInfoBox(trigger, box, onClose);
        });
    }

    // Generic function to show info box
    function showInfoBox(triggerElement, infoBoxElement) {
        if (!triggerElement || !infoBoxElement) return;

        clearTimeout(triggerElement.leaveTimeoutId); // Clear any pending hide actions

        const iconRect = triggerElement.getBoundingClientRect();
        infoBoxElement.style.visibility = 'hidden';
        infoBoxElement.style.display = 'block';
        const infoBoxWidth = infoBoxElement.offsetWidth;
        const infoBoxHeight = infoBoxElement.offsetHeight;
        infoBoxElement.style.display = '';
        infoBoxElement.style.visibility = '';

        let top, left;
        const mobileBreakpoint = 768;
        const padding = 15;

        if (window.innerWidth < mobileBreakpoint) {
            top = iconRect.top - infoBoxHeight - padding;
            left = iconRect.left + (iconRect.width / 2) - (infoBoxWidth / 2);
        } else {
            // Position underneath the icon and centered for desktop (e.g., JKBX info box)
            top = iconRect.bottom + (padding / 3);
            left = iconRect.left + (iconRect.width / 2) - (infoBoxWidth / 2);
        }

        if (top < padding) top = padding;
        if (left < padding) left = padding;
        if (left + infoBoxWidth > window.innerWidth - padding) {
            left = window.innerWidth - infoBoxWidth - padding;
        }
        if (top + infoBoxHeight > window.innerHeight - padding) {
            top = window.innerHeight - infoBoxHeight - padding;
            if (window.innerWidth >= mobileBreakpoint && left + infoBoxWidth > window.innerWidth - padding && triggerElement.id !== 'header-logo') {
                left = iconRect.left - infoBoxWidth - padding;
                if (left < padding) left = padding;
            }
        }

        infoBoxElement.style.top = `${top}px`;
        infoBoxElement.style.left = `${left}px`;
        infoBoxElement.classList.add('visible');
    }

    // Generic function to hide info box
    function hideInfoBox(triggerElement, infoBoxElement) {
        if (!infoBoxElement) return;
        triggerElement.leaveTimeoutId = setTimeout(() => {
            infoBoxElement.classList.remove('visible');
        }, leaveDelay);
    }

    // Setup event listeners for an info box trigger
    function setupInfoBoxEventListeners(triggerElement, infoBoxElement, options = {}) {
        if (!triggerElement || !infoBoxElement) return;

        if (HOVER_CAPABLE) {
            triggerElement.addEventListener('mouseenter', () => showInfoBox(triggerElement, infoBoxElement));
            triggerElement.addEventListener('mouseleave', () => hideInfoBox(triggerElement, infoBoxElement));
            infoBoxElement.addEventListener('mouseenter', () => clearTimeout(triggerElement.leaveTimeoutId));
            infoBoxElement.addEventListener('mouseleave', () => hideInfoBox(triggerElement, infoBoxElement));
            return;
        }

        // Touch: first tap opens the box as a preview instead of following
        // the link immediately (interceptNav holds off navigation for that
        // first tap only — a second tap on the trigger, or on a link inside
        // the box, goes through as normal). Tapping anywhere else closes it.
        const { interceptNav = false, onOpen, onClose } = options;
        touchInfoBoxes.push({ trigger: triggerElement, box: infoBoxElement, onClose });

        triggerElement.addEventListener('click', (event) => {
            if (infoBoxElement.classList.contains('visible')) return; // already open — let this tap proceed
            if (interceptNav) event.preventDefault();
            closeTouchInfoBoxesExcept(triggerElement);
            showInfoBox(triggerElement, infoBoxElement);
            if (onOpen) onOpen();
        });

        document.addEventListener('click', (event) => {
            if (!infoBoxElement.classList.contains('visible')) return;
            if (triggerElement.contains(event.target) || infoBoxElement.contains(event.target)) return;
            closeTouchInfoBox(triggerElement, infoBoxElement, onClose);
        });
    }

    // JKBX Info Box Logic
    setupInfoBoxEventListeners(jkbxLink, jkbxInfoBox, { interceptNav: true });

    // Header Logo Info Box Logic — also drives the pixelation mosaic on
    // touch, since there's no separate hover state to trigger it there.
    setupInfoBoxEventListeners(headerLogoElement, headerLogoInfoBox, {
        onOpen: () => hlActivatePixelation(),
        onClose: () => hlDeactivatePixelation(),
    });

    // --- Header Logo Hover Pixelation ---
    // A canvas sits directly over the logo (pointer-events: none, so the
    // real <img> still receives hover for the info-box/blur effects above).
    // It stays a pixel-perfect copy of the logo at level 1 (indistinguishable
    // from the real image), then mosaics up on hover and back down on leave.
    const headerLogoCanvas = document.getElementById('headerLogoPixelCanvas');
    if (headerLogoElement && headerLogoCanvas) {
        const hlCtx = headerLogoCanvas.getContext('2d');
        const HL_MIN_LEVEL = 1;
        const HL_MAX_LEVEL = 16;
        const HL_TRANSITION_MS = 350;
        let hlCurrentLevel = HL_MIN_LEVEL;
        let hlStartLevel = HL_MIN_LEVEL;
        let hlTargetLevel = HL_MIN_LEVEL;
        let hlTransitionStart = null;
        let hlRafId = null;

        function hlEaseInOutCubic(t) {
            return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        }

        function hlDraw(level) {
            const w = headerLogoCanvas.width;
            const h = headerLogoCanvas.height;
            if (!w || !h) return;
            hlCtx.clearRect(0, 0, w, h);
            const lvl = Math.max(1, Math.round(level));
            if (lvl <= 1) {
                hlCtx.imageSmoothingEnabled = true;
                hlCtx.imageSmoothingQuality = 'high';
                hlCtx.drawImage(headerLogoElement, 0, 0, w, h);
            } else {
                hlCtx.imageSmoothingEnabled = false;
                // Pixelation grid is defined in CSS pixels regardless of DPR,
                // so mosaic blocks look the same size on retina and non-retina screens.
                const dpr = w / headerLogoCanvas.clientWidth || 1;
                const tempW = Math.max(1, Math.floor(w / lvl / dpr));
                const tempH = Math.max(1, Math.floor(h / lvl / dpr));
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = tempW;
                tempCanvas.height = tempH;
                const tempCtx = tempCanvas.getContext('2d');
                tempCtx.imageSmoothingEnabled = false;
                tempCtx.drawImage(headerLogoElement, 0, 0, tempW, tempH);
                hlCtx.drawImage(tempCanvas, 0, 0, tempW, tempH, 0, 0, w, h);
            }
        }

        // At rest, show the real <img> itself (guaranteed full native
        // resolution) rather than a canvas copy of it — the canvas is only
        // shown while actively mosaic-ing, since that's the only time its
        // content needs to differ from the source image.
        function hlShowReal() {
            headerLogoCanvas.style.opacity = '0';
            headerLogoElement.style.opacity = '1';
        }

        function hlShowCanvas() {
            headerLogoCanvas.style.opacity = '1';
            headerLogoElement.style.opacity = '0';
        }

        function hlAnimate(ts) {
            if (hlTransitionStart === null) hlTransitionStart = ts;
            const t = Math.min(1, (ts - hlTransitionStart) / HL_TRANSITION_MS);
            const eased = hlEaseInOutCubic(t);
            hlCurrentLevel = hlStartLevel + (hlTargetLevel - hlStartLevel) * eased;
            hlDraw(hlCurrentLevel);
            if (t < 1) {
                hlRafId = requestAnimationFrame(hlAnimate);
            } else {
                hlRafId = null;
                if (hlTargetLevel === HL_MIN_LEVEL) hlShowReal();
            }
        }

        function hlGoTo(target) {
            hlStartLevel = hlCurrentLevel;
            hlTargetLevel = target;
            hlTransitionStart = null;
            hlShowCanvas();
            if (hlRafId) cancelAnimationFrame(hlRafId);
            hlRafId = requestAnimationFrame(hlAnimate);
        }

        function hlSetupCanvas() {
            const w = headerLogoElement.offsetWidth || headerLogoElement.naturalWidth;
            const h = headerLogoElement.offsetHeight || headerLogoElement.naturalHeight;
            if (!w || !h) return;
            const dpr = window.devicePixelRatio || 1;
            headerLogoCanvas.width = Math.round(w * dpr);
            headerLogoCanvas.height = Math.round(h * dpr);
            headerLogoCanvas.style.width = w + 'px';
            headerLogoCanvas.style.height = h + 'px';
            hlDraw(HL_MIN_LEVEL);
            // Canvas keeps a always-current pixel-perfect copy underneath
            // (needed the instant a hover transition starts), but at rest
            // the real image is what's actually shown — see hlShowReal().
            hlShowReal();
        }

        // The source PNG has its background flattened to opaque white (no
        // real alpha there) — desktop faked transparency via CSS
        // mix-blend-mode: multiply, but that blend reaching through the
        // fixed-position lava-lamp canvas behind it is unreliable on iOS,
        // so the white box shows through. Instead, unmatte the image
        // against white ourselves (recover true alpha + ink color per
        // pixel) and swap the <img> to that real-transparency version,
        // which composites correctly everywhere regardless of blend mode.
        function hlUnmatteFromWhite(imgEl) {
            const c = document.createElement('canvas');
            c.width = imgEl.naturalWidth;
            c.height = imgEl.naturalHeight;
            const cctx = c.getContext('2d');
            cctx.drawImage(imgEl, 0, 0);
            const imgData = cctx.getImageData(0, 0, c.width, c.height);
            const d = imgData.data;
            for (let i = 0; i < d.length; i += 4) {
                const r = d[i], g = d[i + 1], b = d[i + 2];
                const alpha = 255 - Math.min(r, g, b);
                if (alpha === 0) {
                    d[i + 3] = 0;
                } else {
                    const af = alpha / 255;
                    d[i]     = Math.max(0, Math.min(255, Math.round((r - 255 * (1 - af)) / af)));
                    d[i + 1] = Math.max(0, Math.min(255, Math.round((g - 255 * (1 - af)) / af)));
                    d[i + 2] = Math.max(0, Math.min(255, Math.round((b - 255 * (1 - af)) / af)));
                    d[i + 3] = alpha;
                }
            }
            cctx.putImageData(imgData, 0, 0);
            return c.toDataURL('image/png');
        }

        function hlProcessThenSetup() {
            try {
                const transparentSrc = hlUnmatteFromWhite(headerLogoElement);
                headerLogoElement.addEventListener('load', hlSetupCanvas, { once: true });
                headerLogoElement.src = transparentSrc;
            } catch (e) {
                // Canvas tainted (e.g. served from file://) — fall back to
                // the original image; mix-blend-mode still approximates it.
                console.warn('Header logo unmatte skipped:', e);
                hlSetupCanvas();
            }
        }

        if (headerLogoElement.complete && headerLogoElement.naturalWidth > 0) {
            hlProcessThenSetup();
        } else {
            headerLogoElement.addEventListener('load', hlProcessThenSetup, { once: true });
        }

        if (HOVER_CAPABLE) {
            headerLogoElement.addEventListener('mouseenter', () => hlGoTo(HL_MAX_LEVEL));
            headerLogoElement.addEventListener('mouseleave', () => hlGoTo(HL_MIN_LEVEL));
        } else {
            // No hover on touch — the info box's tap-to-toggle handler
            // drives the mosaic instead (see setupInfoBoxEventListeners call above).
            hlActivatePixelation = () => hlGoTo(HL_MAX_LEVEL);
            hlDeactivatePixelation = () => hlGoTo(HL_MIN_LEVEL);
        }
    }

    // --- Video Theater Mode --- //

    const videoPlaceholders = document.querySelectorAll('.video-placeholder');
    const theaterOverlay = document.getElementById('theater-overlay');
    const theaterPlayerContainer = document.getElementById('theater-player-container');

    videoPlaceholders.forEach(placeholder => {
        placeholder.addEventListener('click', () => {
            // TODO: Load the actual video based on placeholder.dataset.videoId
            console.log(`Video placeholder clicked: ${placeholder.closest('.video-item').dataset.videoId}`);

            // Activate theater mode
            document.body.classList.add('theater-mode-active');

            // Placeholder: Add content to the player container later
            theaterPlayerContainer.innerHTML = '<p style="color:white; padding: 20px;">Video Player Would Go Here</p><button id="close-theater" style="position:absolute; top:10px; right:10px; background:red; color:white; border:none; padding:5px 10px; cursor:pointer;">X</button>';

            // Add listener to close button (if it exists)
            const closeButton = document.getElementById('close-theater');
            if (closeButton) {
                closeButton.addEventListener('click', closeTheaterMode, { once: true }); // Remove listener after one click
            }
        });
    });

    // Function to close theater mode
    function closeTheaterMode() {
        document.body.classList.remove('theater-mode-active');
        theaterPlayerContainer.innerHTML = ''; // Clear the player container
    }

    // Also close theater mode if overlay is clicked
    if (theaterOverlay) {
        theaterOverlay.addEventListener('click', closeTheaterMode);
    }

    // --- Red Button: lava-lamp background, 3-click cycle ---

    if (redButtonLink) {
        redButtonLink.addEventListener('click', (event) => {
            event.preventDefault(); // Prevent default anchor behavior

            // Increment and update click log message
            redButtonClickCount++;
            if (clickLogMessageElement) {
                if (redButtonClickCount === 1) {
                    clickLogMessageElement.style.display = 'block';
                }
                clickLogMessageElement.innerHTML = `you\'ve clicked the button <span class="click-count-number">${redButtonClickCount}</span> times.`;
            }

            // 4-click cycle: white -> blur -> unblur -> reblur -> white
            const cyclePos = redButtonClickCount % 4;

            if (cyclePos === 1) {
                if (redButtonLavaController) redButtonLavaController.destroy();
                if (redButtonBgCanvas && window.LavaLampBG) {
                    redButtonLavaController = window.LavaLampBG.create(redButtonBgCanvas);
                }
            } else if (cyclePos === 2) {
                if (redButtonLavaController) redButtonLavaController.unblur();
            } else if (cyclePos === 3) {
                if (redButtonLavaController) redButtonLavaController.reblur();
            } else {
                if (redButtonLavaController) {
                    redButtonLavaController.destroy();
                    redButtonLavaController = null;
                }
            }
        });
    }

    // --- James Peach Page - Interactive Image Placeholder --- //
    if (document.body.classList.contains('james-peach-page')) {
        console.log('James Peach page specific script initializing...');
        const interactivePlaceholders = document.querySelectorAll('.jp-interactive-placeholder');
        const body = document.body;
        console.log(`Found ${interactivePlaceholders.length} interactive placeholder(s).`);

        interactivePlaceholders.forEach((placeholder, index) => {
            console.log(`Processing placeholder #${index}:`, placeholder);
            const preview = placeholder.querySelector('.jp-preview-image'); 
            const expandedView = placeholder.querySelector('.jp-expanded-view');

            // console.log(`Placeholder #${index} - Preview element:`, preview); // Kept for debugging
            // console.log(`Placeholder #${index} - Expanded view element:`, expandedView); // Kept for debugging

            if (!preview) {
                console.error(`Placeholder #${index}: Critical error - '.jp-preview-image' child not found. Cannot attach click listener or open modal.`);
                return; // Essential to stop if preview doesn't exist
            }
            if (!expandedView) {
                console.error(`Placeholder #${index}: Critical error - '.jp-expanded-view' child not found. Modal cannot be shown even if opened.`);
                return; // Essential to stop if expanded view doesn't exist
            }

            const openItem = () => {
                console.log(`Attempting to open item for placeholder #${index}`);
                
                // Guard clause 1: Prevent opening if another known modal system is active
                if (body.classList.contains('gallery-active') || body.classList.contains('theater-mode-active')) {
                    console.warn(`Cannot open JP modal for placeholder #${index}: Another modal system ('gallery-active' or 'theater-mode-active') is currently active.`);
                    return;
                }

                // Guard clause 2: Prevent re-opening if this specific item is already expanded
                if (placeholder.classList.contains('expanded')) {
                    console.log(`JP modal for placeholder #${index} is already expanded. No action taken.`);
                    return;
                }
                
                placeholder.classList.add('expanded');
                body.classList.add('jp-gallery-active');
                console.log(`SUCCESS: JP modal for placeholder #${index} opened. Classes added: 'expanded' to placeholder, 'jp-gallery-active' to body.`);
            };

            const closeItem = () => {
                console.log(`Attempting to close item for placeholder #${index}`);
                placeholder.classList.remove('expanded');
                body.classList.remove('jp-gallery-active');
                console.log(`SUCCESS: JP modal for placeholder #${index} closed. Classes removed.`);
            };

            // Event Listeners:
            // Strictly attach click listener to the 'preview' element, similar to art.js
            console.log(`Attaching click listener to specific preview element for placeholder #${index}:`, preview);
            preview.addEventListener('click', openItem);

            // Keydown for Enter on the main placeholder (for accessibility when focused)
            placeholder.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' && document.activeElement === placeholder) {
                    console.log(`Enter key pressed on focused placeholder #${index}. Attempting to open item.`);
                    openItem();
                }
            });

            // Click on the expanded view (overlay) to close
            expandedView.addEventListener('click', (event) => {
                if (event.target === expandedView) {
                    console.log(`Expanded view overlay clicked for placeholder #${index}. Attempting to close item.`);
                    closeItem();
                } else {
                    console.log(`Click detected inside expanded view (likely on image/descriptor), not closing. Target:`, event.target);
                }
            });

            // Document-level listener for Escape key to close an active modal
            document.addEventListener('keydown', (event) => {
                if (event.key === 'Escape' && placeholder.classList.contains('expanded')) {
                    console.log(`Escape key pressed while JP modal for placeholder #${index} is expanded. Attempting to close item.`);
                    closeItem();
                }
            });
        });
    }

    const logoContainer = document.querySelector('.hero-title-gif');
    // Only proceed if the logoContainer exists on the current page
    if (logoContainer) {
        const gifSrc = logoContainer.dataset.gifSrc;
        if (!gifSrc) {
            console.error('data-gif-src attribute not found on .hero-title-gif container.');
            // Return or exit function if critical, or handle gracefully
        } else {
            const numSlices = 90; 
            const rippleDelayIncrement = 0.08; 

            const img = new Image();
            img.onload = () => {
                const computedStyle = getComputedStyle(logoContainer);
                const parsedMaxHeight = parseFloat(computedStyle.maxHeight);
                
                const heroSection = document.querySelector('.jp-hero-section');
                let calculatedMaxWidth = 0;
                if (heroSection) {
                    calculatedMaxWidth = heroSection.offsetWidth * 0.90; 
                } else {
                    calculatedMaxWidth = logoContainer.offsetWidth;
                }

                const containerMaxWidth = calculatedMaxWidth > 0 ? calculatedMaxWidth : (logoContainer.offsetWidth || img.naturalWidth);
                const containerMaxHeight = parsedMaxHeight || logoContainer.offsetHeight || img.naturalHeight;

                const imgAspectRatio = img.naturalWidth / img.naturalHeight;
                const safeContainerMaxWidth = Math.max(1, containerMaxWidth);
                const safeContainerMaxHeight = Math.max(1, containerMaxHeight);

                let targetWidth = img.naturalWidth;
                let targetHeight = img.naturalHeight;

                const hasMaxWidth = safeContainerMaxWidth > 1 && isFinite(safeContainerMaxWidth);
                const hasMaxHeight = safeContainerMaxHeight > 1 && isFinite(safeContainerMaxHeight);

                if (hasMaxWidth && hasMaxHeight) {
                    const containerAspectRatio = safeContainerMaxWidth / safeContainerMaxHeight;
                    if (imgAspectRatio > containerAspectRatio) {
                        targetWidth = safeContainerMaxWidth;
                        targetHeight = targetWidth / imgAspectRatio;
                        if (targetHeight > safeContainerMaxHeight) {
                            targetHeight = safeContainerMaxHeight;
                            targetWidth = targetHeight * imgAspectRatio;
                        }
                    } else {
                        targetHeight = safeContainerMaxHeight;
                        targetWidth = targetHeight * imgAspectRatio;
                        if (targetWidth > safeContainerMaxWidth) {
                            targetWidth = safeContainerMaxWidth;
                            targetHeight = targetWidth / imgAspectRatio;
                        }
                    }
                } else if (hasMaxWidth) {
                    targetWidth = safeContainerMaxWidth;
                    targetHeight = targetWidth / imgAspectRatio;
                } else if (hasMaxHeight) {
                    targetHeight = safeContainerMaxHeight;
                    targetWidth = targetHeight * imgAspectRatio;
                }

                let finalContainerWidth = targetWidth;
                let finalContainerHeight = targetHeight;
                
                if (finalContainerWidth === 0 && hasMaxHeight) { 
                     finalContainerHeight = safeContainerMaxHeight;
                     finalContainerWidth = finalContainerHeight * imgAspectRatio;
                     if (hasMaxWidth && finalContainerWidth > safeContainerMaxWidth) { 
                        finalContainerWidth = safeContainerMaxWidth;
                        finalContainerHeight = finalContainerWidth / imgAspectRatio;
                     }
                }
                if (finalContainerHeight === 0 && hasMaxWidth && logoContainer.style.aspectRatio) {
                     finalContainerWidth = safeContainerMaxWidth;
                     finalContainerHeight = finalContainerWidth / imgAspectRatio;
                     if (hasMaxHeight && finalContainerHeight > safeContainerMaxHeight) {
                        finalContainerHeight = safeContainerMaxHeight;
                        finalContainerWidth = finalContainerHeight * imgAspectRatio;
                     }
                }

                if ((finalContainerWidth <= 1 || finalContainerHeight <= 1) && (hasMaxWidth || hasMaxHeight)) {
                    if (hasMaxHeight && hasMaxWidth) {
                        if ((safeContainerMaxWidth / safeContainerMaxHeight) > imgAspectRatio) {
                            finalContainerHeight = safeContainerMaxHeight;
                            finalContainerWidth = finalContainerHeight * imgAspectRatio;
                        } else { 
                            finalContainerWidth = safeContainerMaxWidth;
                            finalContainerHeight = finalContainerWidth / imgAspectRatio;
                        }
                    } else if (hasMaxHeight) { 
                         finalContainerHeight = safeContainerMaxHeight;
                         finalContainerWidth = finalContainerHeight * imgAspectRatio;
                    } else if (hasMaxWidth) { 
                         finalContainerWidth = safeContainerMaxWidth;
                         finalContainerHeight = finalContainerWidth / imgAspectRatio;
                    } else {
                        finalContainerWidth = img.naturalWidth; 
                        finalContainerHeight = img.naturalHeight;
                    }
                }
                
                if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                    if (finalContainerWidth <= 0) finalContainerWidth = 1;
                    if (finalContainerHeight <= 0) finalContainerHeight = 1;
                }

                logoContainer.style.width = `${finalContainerWidth}px`;
                logoContainer.style.height = `${finalContainerHeight}px`;
                logoContainer.style.aspectRatio = 'auto'; 

                while (logoContainer.firstChild) {
                    logoContainer.removeChild(logoContainer.firstChild);
                }

                let accumulatedWidth = 0;
                for (let i = 0; i < numSlices; i++) {
                    const slice = document.createElement('div');
                    slice.classList.add('logo-slice');

                    const currentImageX = Math.round((i / numSlices) * finalContainerWidth);
                    const nextImageX = Math.round(((i + 1) / numSlices) * finalContainerWidth);
                    
                    let sliceDivWidth;
                    if (i === numSlices - 1) {
                        sliceDivWidth = finalContainerWidth - accumulatedWidth;
                    } else {
                        sliceDivWidth = nextImageX - currentImageX;
                    }
                    
                    sliceDivWidth = Math.max(0, sliceDivWidth);

                    slice.style.width = `${sliceDivWidth}px`;
                    slice.style.backgroundImage = `url(${gifSrc})`;
                    slice.style.backgroundSize = `${finalContainerWidth}px ${finalContainerHeight}px`;
                    slice.style.backgroundPositionX = `-${currentImageX}px`;
                    slice.style.animationDelay = `${i * rippleDelayIncrement}s`;
                    
                    logoContainer.appendChild(slice);
                    accumulatedWidth += sliceDivWidth;
                }
            };

            img.onerror = () => {
                console.error('Failed to load GIF:', gifSrc);
            };

            img.src = gifSrc;
        }
    } // End of the if (logoContainer) block

    const videoItems = document.querySelectorAll('.video-gallery .video-item');

    // Function to hide all video descriptions
    function hideAllDescriptions() {
        videoItems.forEach(item => {
            const descriptionBox = item.querySelector('.video-description');
            if (descriptionBox) {
                descriptionBox.classList.remove('description-visible');
            }
        });
    }

    videoItems.forEach(item => {
        const video = item.querySelector('video');
        const descriptionBox = item.querySelector('.video-description');

        if (video && descriptionBox) {
            video.addEventListener('play', () => {
                console.log('[Video Player] Play event triggered for:', video.src);
                console.log('[Video Player] Corresponding description box:', descriptionBox);
                hideAllDescriptions(); // Hide others first
                descriptionBox.classList.add('description-visible'); // Show current
                console.log('[Video Player] Added .description-visible to:', descriptionBox);
            });

            video.addEventListener('pause', () => {
                console.log('[Video Player] Pause event triggered for:', video.src);
                descriptionBox.classList.remove('description-visible');
                console.log('[Video Player] Removed .description-visible from (on pause):', descriptionBox);
            });

            video.addEventListener('ended', () => {
                console.log('[Video Player] Ended event triggered for:', video.src);
                descriptionBox.classList.remove('description-visible');
                console.log('[Video Player] Removed .description-visible from (on ended):', descriptionBox);
            });
        } else {
            if (!video) console.error('[Video Player] Video element not found in item:', item);
            if (!descriptionBox) console.error('[Video Player] Description box not found in item:', item);
        }
    });

    // Comet animation logic (if any further interaction is needed beyond CSS)
});

// --- Art Icon Pixelation Pulse ---
document.addEventListener('DOMContentLoaded', () => {
    const artIconImageEl = document.getElementById('artIconImage');
    const artIconCanvasEl = document.getElementById('artIconCanvas');
    let artIconCtx = null;
    let artIconOriginalImage = null; // Will be new Image()

    let isArtIconPulsing = false;
    let artIconPulseRequestId = null;
    let artIconPulseStartTime = 0;
    const artIconPulseMinPixelation = 1;
    const artIconPulseMaxPixelation = 20;
    const artIconPulseBPM = 12;
    const artIconMinPixelationHangTime = 1500; // 1.5 seconds hang time at minimum pixelation
    let artIconTransitionDuration; // Calculated based on BPM and hang time

    let currentArtIconAnimationState = 'HANGING_AT_MIN'; // Initial state

    function easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    function applyArtIconPixelation(pixelationLevel) {
        if (!artIconOriginalImage || !artIconCtx || !artIconCanvasEl || !artIconOriginalImage.complete || artIconOriginalImage.naturalWidth === 0) return;

        const canvasWidth = artIconCanvasEl.width;
        const canvasHeight = artIconCanvasEl.height;

        artIconCtx.clearRect(0, 0, canvasWidth, canvasHeight);
        const level = Math.max(1, Math.round(pixelationLevel)); // Ensure level is at least 1

        if (level <= 1) {
            artIconCtx.imageSmoothingEnabled = true;
            artIconCtx.drawImage(artIconOriginalImage, 0, 0, artIconOriginalImage.naturalWidth, artIconOriginalImage.naturalHeight, 0, 0, canvasWidth, canvasHeight);
        } else {
            artIconCtx.imageSmoothingEnabled = false;
            const tempW = Math.max(1, Math.floor(artIconOriginalImage.naturalWidth / level));
            const tempH = Math.max(1, Math.floor(artIconOriginalImage.naturalHeight / level));

            const tempPixelCanvas = document.createElement('canvas');
            tempPixelCanvas.width = tempW;
            tempPixelCanvas.height = tempH;
            const tempPixelCtx = tempPixelCanvas.getContext('2d');

            if (!tempPixelCtx) return;
            tempPixelCtx.imageSmoothingEnabled = false;
            tempPixelCtx.drawImage(artIconOriginalImage, 0, 0, artIconOriginalImage.naturalWidth, artIconOriginalImage.naturalHeight, 0, 0, tempW, tempH);
            artIconCtx.drawImage(tempPixelCanvas, 0, 0, tempW, tempH, 0, 0, canvasWidth, canvasHeight);
        }
    }

    function animateArtIconPulse() {
        if (!isArtIconPulsing || !artIconCtx) return;

        const currentTime = performance.now();
        const elapsedTime = currentTime - artIconPulseStartTime;
        let currentPixelation = artIconPulseMinPixelation;

        switch (currentArtIconAnimationState) {
            case 'HANGING_AT_MIN':
                currentPixelation = artIconPulseMinPixelation;
                if (elapsedTime >= artIconMinPixelationHangTime) {
                    currentArtIconAnimationState = 'PULSING_TO_MAX';
                    artIconPulseStartTime = currentTime; // Reset start time for new state
                }
                break;

            case 'PULSING_TO_MAX':
                if (artIconTransitionDuration <= 0) { // Should not happen if checked in start
                    currentPixelation = artIconPulseMaxPixelation;
                    currentArtIconAnimationState = 'PULSING_TO_MIN';
                    artIconPulseStartTime = currentTime;
                } else {
                    const normalizedTime = Math.min(1, elapsedTime / artIconTransitionDuration);
                    const easedProgress = easeInOutCubic(normalizedTime);
                    currentPixelation = artIconPulseMinPixelation + (artIconPulseMaxPixelation - artIconPulseMinPixelation) * easedProgress;
                    if (normalizedTime >= 1) {
                        currentArtIconAnimationState = 'PULSING_TO_MIN';
                        artIconPulseStartTime = currentTime;
                    }
                }
                break;

            case 'PULSING_TO_MIN':
                 if (artIconTransitionDuration <= 0) { // Should not happen
                    currentPixelation = artIconPulseMinPixelation;
                    currentArtIconAnimationState = 'HANGING_AT_MIN';
                    artIconPulseStartTime = currentTime;
                } else {
                    const normalizedTime = Math.min(1, elapsedTime / artIconTransitionDuration);
                    const easedProgress = easeInOutCubic(normalizedTime);
                    currentPixelation = artIconPulseMaxPixelation - (artIconPulseMaxPixelation - artIconPulseMinPixelation) * easedProgress;
                    if (normalizedTime >= 1) {
                        currentArtIconAnimationState = 'HANGING_AT_MIN';
                        artIconPulseStartTime = currentTime;
                    }
                }
                break;
        }

        applyArtIconPixelation(currentPixelation);
        artIconPulseRequestId = requestAnimationFrame(animateArtIconPulse);
    }

    function startArtIconPulse() {
        if (isArtIconPulsing || !artIconCtx) return;

        const totalCycleDurationMs = 60000 / artIconPulseBPM;
        const totalTransitionTimeMs = totalCycleDurationMs - artIconMinPixelationHangTime;

        if (totalTransitionTimeMs <= 0) {
            console.warn(`Art Icon Pulse: Hang time (${artIconMinPixelationHangTime}ms) is too long for BPM (${artIconPulseBPM}). 
                           Total cycle time is ${totalCycleDurationMs}ms. Transitions will be instant or hang time reduced.`);
            // Option 1: Reduce hang time to make transitions possible (e.g., 100ms each)
            // artIconTransitionDuration = 100; 
            // artIconMinPixelationHangTime = totalCycleDurationMs - 200; 
            // if (artIconMinPixelationHangTime < 0) artIconMinPixelationHangTime = 0;
            // Option 2: Make transitions instant if hang time is too dominant
            artIconTransitionDuration = 0; // This will make it snap
            // Or default to a very short transition, e.g., 50ms
            // artIconTransitionDuration = 50;
            // For now, we'll log a warning and transitions might be very fast or instant.
        } else {
            artIconTransitionDuration = totalTransitionTimeMs / 2; // Divide by 2 for to_max and to_min phases
        }
        
        isArtIconPulsing = true;
        currentArtIconAnimationState = 'HANGING_AT_MIN'; // Start by hanging at min
        artIconPulseStartTime = performance.now();
        animateArtIconPulse();
    }

    function stopArtIconPulse() {
        isArtIconPulsing = false;
        if (artIconPulseRequestId) {
            cancelAnimationFrame(artIconPulseRequestId);
            artIconPulseRequestId = null;
        }
    }

    function initArtIconPixelation() {
        if (!artIconImageEl || !artIconCanvasEl) {
            console.error('Art icon image or canvas element not found for pixelation.');
            return;
        }

        artIconOriginalImage = new Image();

        artIconOriginalImage.onload = () => {
            let displayWidth = artIconImageEl.offsetWidth;
            let displayHeight = artIconImageEl.offsetHeight;

            if (displayWidth === 0 || displayHeight === 0) {
                console.warn("Art icon image offsetWidth/Height is 0. Using natural dimensions for canvas.");
                displayWidth = artIconOriginalImage.naturalWidth;
                displayHeight = artIconOriginalImage.naturalHeight;
            }

            if (displayWidth === 0 || displayHeight === 0) {
                console.error("Could not determine dimensions for art icon canvas after fallback.");
                return;
            }

            artIconCanvasEl.width = displayWidth;
            artIconCanvasEl.height = displayHeight;
            
            // Match the display style of the image if it was, for example, inline
            const imageDisplayStyle = window.getComputedStyle(artIconImageEl).display;
            artIconCanvasEl.style.display = imageDisplayStyle === 'none' ? 'block' : imageDisplayStyle;

            artIconCtx = artIconCanvasEl.getContext('2d');
            if (!artIconCtx) {
                console.error('Failed to get 2D context for art icon canvas.');
                if(artIconCanvasEl) artIconCanvasEl.style.display = 'none'; // Hide canvas
                if(artIconImageEl) artIconImageEl.style.display = imageDisplayStyle; // Show original image
                return;
            }

            artIconImageEl.style.display = 'none';
            startArtIconPulse();
        };

        artIconOriginalImage.onerror = () => {
            console.error('Failed to load art icon image for pixelation: ' + (artIconImageEl ? artIconImageEl.src : ''));
            if (artIconCanvasEl) artIconCanvasEl.style.display = 'none';
            if (artIconImageEl) artIconImageEl.style.display = window.getComputedStyle(artIconImageEl).display || 'inline-block'; // Revert to original display
        };
        
        if (artIconImageEl.src) {
            artIconOriginalImage.src = artIconImageEl.src;
        } else {
            console.error('Art icon image element has no src.');
            return;
        }

        // Handle cases where the image might already be cached and loaded
        if (artIconImageEl.complete && artIconImageEl.naturalWidth > 0) {
            // Call onload manually if already complete, with a tiny delay for safety
            setTimeout(() => {
                 // Check again in case onload fired naturally in a race condition
                if (artIconOriginalImage.naturalWidth > 0 && !artIconCtx) { 
                    artIconOriginalImage.onload();
                }
            }, 0);
        }
    }

    if (artIconImageEl && artIconCanvasEl) {
        initArtIconPixelation();
    } else {
        if (!artIconImageEl) console.warn("Art icon image element (#artIconImage) not found on DOMContentLoaded.");
        if (!artIconCanvasEl) console.warn("Art icon canvas element (#artIconCanvas) not found on DOMContentLoaded.");
    }
}); 