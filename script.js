document.addEventListener('DOMContentLoaded', () => {
    const jkbxLink = document.getElementById('jkbx-link');
    const jkbxInfoBox = document.getElementById('jkbx-info-box');
    // const blurOverlay = document.getElementById('blur-overlay'); // Get overlay element // Not used

    const redButtonLink = document.getElementById('red-button-link'); // New Red Button

    // Header Logo Info Box elements
    const headerLogoElement = document.getElementById('header-logo');
    const headerLogoInfoBox = document.getElementById('header-logo-info-box');

    // New element references for apocalypse sequence
    const siteHeader = document.querySelector('.site-header');
    const iconGrid = document.querySelector('.icon-grid');
    const selfDestructPopup = document.getElementById('self-destruct-popup');
    const apocalypseOverlay = document.getElementById('apocalypse-overlay'); // <-- ADD THIS LINE

    // Click Log Message elements
    const clickLogMessageElement = document.getElementById('click-log-message');
    let redButtonClickCount = 0;

    let leaveTimeout; // Variable to hold the timeout ID
    const leaveDelay = 300; // Delay in milliseconds before hiding

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
    function setupInfoBoxEventListeners(triggerElement, infoBoxElement) {
        if (!triggerElement || !infoBoxElement) return;

        triggerElement.addEventListener('mouseenter', () => showInfoBox(triggerElement, infoBoxElement));
        triggerElement.addEventListener('mouseleave', () => hideInfoBox(triggerElement, infoBoxElement));
        infoBoxElement.addEventListener('mouseenter', () => clearTimeout(triggerElement.leaveTimeoutId));
        infoBoxElement.addEventListener('mouseleave', () => hideInfoBox(triggerElement, infoBoxElement));
    }

    // JKBX Info Box Logic
    setupInfoBoxEventListeners(jkbxLink, jkbxInfoBox);

    // Header Logo Info Box Logic
    setupInfoBoxEventListeners(headerLogoElement, headerLogoInfoBox);

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

    // --- MODIFIED: Red Button Functionality ---
    // const secretTrigger = document.getElementById('secret-hover-trigger');
    // const colorMessage = document.getElementById('color-picker-message');
    // const openSecretMenuLink = document.getElementById('open-secret-menu-link');

    // const horrorTrigger = document.getElementById('horror-hover-trigger');
    // const horrorMessageBox = document.getElementById('horror-message-box');
    // const horrorActionLink = document.getElementById('horror-action-link'); // Element is now removed from HTML

    let nukeIntervalId = null;
    let originalBodyBgImage = ''; // Retain for background restoration
    let originalBodyBgColor = ''; // Retain for background restoration
    let isNukeActive = false; // Retain for scary effect state
    // let isGradientActive = false; // This will be managed by isRedButtonBgColorActive
    // let isSecretMenuOpen = false; // Removed

    let isRedButtonScaryActive = false; // Tracks state of scary effect for the red button
    let isRedButtonBgColorActive = false; // Tracks state of background color change for the red button

    let isCountdownActive = false;
    let countdownIntervalId = null;
    let currentCountdownValue = 10;
    const countdownDisplayElement = document.getElementById('countdown-display'); // Cache element

    // State for apocalypse sequence - Moved here for correct scope
    let isApocalypseSequenceActive = false;
    let pageCloseTimeoutId = null; // For the final page "close" action

    // --- Intermittent Message Logic (shared helper) ---
    // This logic is no longer needed as the hover/intermittent messages are removed.
    /*
    const INTERMITTENT_SHOW_DELAY = 15000;
    const INTERMITTENT_DURATION = 4000;
    let secretMessageHideTimeout, horrorMessageHideTimeout;
    let secretIntermittentShowInterval, horrorIntermittentShowInterval;

    function setupIntermittentDisplay(triggerEl, messageEl, pHideTimeout, pIntermittentInterval, pShowCallback) {
        if (triggerEl) {
            triggerEl.addEventListener('mouseenter', () => {
                clearInterval(pIntermittentInterval);
                clearTimeout(pHideTimeout);
                pShowCallback(false, messageEl); // Show immediately, not as intermittent
            });
            triggerEl.addEventListener('mouseleave', () => {
                // Hide with delay only if the message itself isn't hovered
                if (!messageEl.matches(':hover')) {
                     pHideTimeout = setTimeout(() => messageEl.classList.add('hidden'), 100);
                }
            });
        }
        if (messageEl) {
            messageEl.addEventListener('mouseenter', () => {
                clearInterval(pIntermittentInterval);
                clearTimeout(pHideTimeout);
                // Ensure it's shown if mouse directly enters message
                pShowCallback(false, messageEl);
            });
            messageEl.addEventListener('mouseleave', () => {
                 pHideTimeout = setTimeout(() => messageEl.classList.add('hidden'), 100);
            });
        }

        // Start intermittent display
        clearInterval(pIntermittentInterval); // Clear any existing
        if (messageEl && messageEl.classList.contains('hidden')) {
            pIntermittentInterval = setInterval(() => {
                if (messageEl.classList.contains('hidden') && !triggerEl.matches(':hover') && !messageEl.matches(':hover')) {
                    pShowCallback(true, messageEl); // Show as intermittent
                }
            }, INTERMITTENT_SHOW_DELAY + INTERMITTENT_DURATION);
            setTimeout(() => {
                if (messageEl.classList.contains('hidden') && !triggerEl.matches(':hover') && !messageEl.matches(':hover')) {
                    pShowCallback(true, messageEl);
                }
            }, INTERMITTENT_SHOW_DELAY);
        }
        return { pHideTimeout, pIntermittentInterval }; // Return to update outer scope variables
    }
    
    // --- Color Message Logic ---
    const showColorMessage = (isIntermittent = false, messageEl = colorMessage) => {
        if (messageEl) {
            messageEl.classList.remove('hidden');
            if (isIntermittent) {
                secretMessageHideTimeout = setTimeout(() => messageEl.classList.add('hidden'), INTERMITTENT_DURATION);
            }
        }
    };
    // const r1 = setupIntermittentDisplay(secretTrigger, colorMessage, secretMessageHideTimeout, secretIntermittentShowInterval, showColorMessage);
    // secretMessageHideTimeout = r1.pHideTimeout;
    // secretIntermittentShowInterval = r1.pIntermittentInterval;

    // --- Horror Message Logic ---
    const showHorrorMessage = (isIntermittent = false, messageEl = horrorMessageBox) => {
        if (messageEl) {
            messageEl.classList.remove('hidden');
            if (isIntermittent) {
                horrorMessageHideTimeout = setTimeout(() => messageEl.classList.add('hidden'), INTERMITTENT_DURATION);
            }
        }
    };
    // const r2 = setupIntermittentDisplay(horrorTrigger, horrorMessageBox, horrorMessageHideTimeout, horrorIntermittentShowInterval, showHorrorMessage);
    // horrorMessageHideTimeout = r2.pHideTimeout;
    // horrorIntermittentShowInterval = r2.pIntermittentInterval;
    
    // --- Stop Intermittent (generic, called on action) ---
    function stopIntermittent(interval, timeout) {
        clearInterval(interval);
        clearTimeout(timeout);
    }
    */

    // --- Main Controls Rendering (after "Open Secret Menu" is clicked) ---
    // This function is no longer needed as the UI for this is gone.
    /*
    function renderMainControlMessage() {
        if (!colorMessage || !isSecretMenuOpen) return;

        let htmlContent = "you can ";
        if (isGradientActive) {
            htmlContent += `<span id="change-color-link" class="action-link">Try Again</span>, or `;
            htmlContent += `<span id="back-to-basic-link" class="action-link">Back to Basic</span>.`;
        } else {
            htmlContent += `<span id="change-color-link" class="action-link">Change the Color</span>.`;
        }
        colorMessage.innerHTML = htmlContent;

        const newChangeColorLink = document.getElementById('change-color-link');
        const newBackToBasicLink = document.getElementById('back-to-basic-link');

        if (newChangeColorLink) {
            newChangeColorLink.addEventListener('click', (event) => {
                event.stopPropagation();
                // stopIntermittent(secretIntermittentShowInterval, secretMessageHideTimeout); // Old call
                applyRandomGradient();
            });
        }
        if (newBackToBasicLink) {
            newBackToBasicLink.addEventListener('click', (event) => {
                event.stopPropagation();
                // stopIntermittent(secretIntermittentShowInterval, secretMessageHideTimeout); // Old call
                wipeTheSlate();
            });
        }
        // showColorMessage(); // Keep it visible
    }
    */

    // --- Secret Menu Activation & Click Handlers --- (Old logic to be removed/adapted)
    // if (openSecretMenuLink) {
    //     openSecretMenuLink.addEventListener('click', (event) => {
    //         event.stopPropagation();
    //         isSecretMenuOpen = true;
    //         stopIntermittent(secretIntermittentShowInterval, secretMessageHideTimeout);
    //         renderMainControlMessage();
    //         // Prevent the message from hiding immediately if the link inside it was clicked
    //         if (colorMessage && colorMessage.matches(':hover')) {
    //             clearTimeout(secretMessageHideTimeout); // Assuming secretMessageHideTimeout is the one for colorMessage
    //         }
    //     });
    // }

    // Color changing functions (applyRandomGradient, wipeTheSlate) will be called by red button
    // Horror effect function (toggleNukeMode) will be called by red button

    // if (horrorActionLink) { ... } // This entire block can be removed as horrorActionLink is gone.


    // --- NEW RED BUTTON LOGIC ---
    if (redButtonLink) {
        redButtonLink.addEventListener('click', (event) => {
            event.preventDefault(); // Prevent default anchor behavior

            // Increment and update click log message
            redButtonClickCount++;
            if (clickLogMessageElement) {
                if (redButtonClickCount === 1) {
                    clickLogMessageElement.style.display = 'block'; // Or 'inline', 'inline-block' depending on desired layout
                }
                clickLogMessageElement.innerHTML = `you\'ve clicked the button <span class="click-count-number">${redButtonClickCount}</span> times.`;
            }

            const currentlyNukeActive = isNukeActive;
            const currentlyBgColorActive = isRedButtonBgColorActive;
            // const currentlyCountdownActive = isCountdownActive; // Countdown is now tied to nuke mode

            const randomNumber = Math.random();
            let actionToPerform; // 0: nuke, 1: bgcolor

            if (randomNumber < 0.05) { // 5% chance for Nuke
                actionToPerform = 0; // Nuke
            } else {
                actionToPerform = 1; // Background Color
            }

            // Priority: If the selected action is ALREADY active, toggle IT off.
            // Otherwise, turn off ANY OTHER active effect before starting the new one.

            if (actionToPerform === 0) { // Selected: Nuke
                if (currentlyNukeActive) {
                    toggleNukeMode(); // Turn off nuke (this will also stop countdown)
                } else {
                    if (currentlyBgColorActive) wipeTheSlate();
                    // No need to explicitly stop countdown here, as it only runs if nuke is active
                    toggleNukeMode(); // Turn on nuke (this will also start countdown)
                }
            } else if (actionToPerform === 1) { // Selected: Background Color
                // If background color is already active, wipeTheSlate will turn it off.
                // If nuke mode (and thus countdown) is active, turn it off first.
                if (currentlyNukeActive) {
                    toggleNukeMode(); // This will also stop the countdown
                }
                
                // Now toggle the background color effect
                if (isRedButtonBgColorActive) { // Check current state as nuke might have changed it
                    wipeTheSlate();
                } else {
                    applyRandomGradient();
                }
            }
            // Countdown logic is removed from here, now handled within toggleNukeMode
        });
    }


    // --- Helper Functions (getRandomHexColor, getRandomDirection, applyRandomGradient, wipeTheSlate, updateHorrorLinkText, toggleNukeMode) ---
    // These should largely remain, but ensure they are compatible with the new calling context.

    function getRandomHexColor() {
        let color = '#';
        for (let i = 0; i < 6; i++) {
            color += Math.floor(Math.random() * 16).toString(16);
        }
        return color;
    }

    const gradientDirections = [
        'to right', 'to left', 'to bottom', 'to top',
        'to top right', 'to top left', 'to bottom right', 'to bottom left',
        '45deg', '-45deg', '135deg', '-135deg', '90deg', '0deg'
    ];

    function getRandomDirection() {
        return gradientDirections[Math.floor(Math.random() * gradientDirections.length)];
    }

    const radialShapes = ['circle', 'ellipse'];
    const radialPositions = [
        'center', 'center center',
        'top', 'center top',
        'bottom', 'center bottom',
        'left', 'left center',
        'right', 'right center',
        'top left', 'left top',
        'top right', 'right top',
        'bottom left', 'left bottom',
        'bottom right', 'right bottom'
    ];

    function getRandomRadialShape() {
        return radialShapes[Math.floor(Math.random() * radialShapes.length)];
    }

    function getRandomRadialPosition() {
        return radialPositions[Math.floor(Math.random() * radialPositions.length)];
    }

    function applyRandomGradient() {
        const numColors = Math.floor(Math.random() * 2) + 2; // Randomly 2 or 3 colors
        const colors = [];
        for (let i = 0; i < numColors; i++) {
            colors.push(getRandomHexColor());
        }

        let gradientStyle;
        if (Math.random() < 0.7) { // 70% chance for linear gradient
            const direction = getRandomDirection();
            gradientStyle = `linear-gradient(${direction}, ${colors.join(', ')})`;
        } else { // 30% chance for radial gradient
            const shape = getRandomRadialShape();
            const position = getRandomRadialPosition();
            gradientStyle = `radial-gradient(${shape} at ${position}, ${colors.join(', ')})`;
        }

        document.body.style.backgroundImage = gradientStyle;
        document.body.style.backgroundColor = ''; // Clear solid background color
        isRedButtonBgColorActive = true; 
    }

    function wipeTheSlate() {
        document.body.style.backgroundImage = originalBodyBgImage || '';
        document.body.style.backgroundColor = originalBodyBgColor || 'white'; // Default to white
        // isGradientActive = false; // Old UI state
        // renderMainControlMessage(); // Old UI update
        isRedButtonBgColorActive = false; // Ensure red button state is also reset
    }

    // function updateHorrorLinkText() { ... } // This function can be removed as horrorActionLink is gone.

    function toggleNukeMode() {
        if (isNukeActive) {
            // Stop the nuke mode
            clearInterval(nukeIntervalId);
            nukeIntervalId = null;
            document.body.style.backgroundColor = originalBodyBgColor || 'white'; // Restore background
            document.body.style.backgroundImage = originalBodyBgImage || '';
            isNukeActive = false;
            stopCountdown(); // Stop countdown when nuke mode stops
        } else {
            // Start the nuke mode
            if (originalBodyBgColor === '' && originalBodyBgImage === '') { // Store original only once
                originalBodyBgColor = document.body.style.backgroundColor;
                originalBodyBgImage = document.body.style.backgroundImage;
            }
            let isRed = true;
            document.body.style.transition = 'none';
            nukeIntervalId = setInterval(() => {
                document.body.style.backgroundColor = isRed ? 'red' : 'black';
                document.body.style.backgroundImage = 'none';
                isRed = !isRed;
            }, 100);
            isNukeActive = true;
            startCountdown(); // Start countdown when nuke mode starts
        }
    }

    // Store original body background on load
    // Ensure this is done *before* any potential nuke/gradient might change them initially
    // This should be safe here as DOMContentLoaded ensures body exists.
    originalBodyBgImage = document.body.style.backgroundImage;
    originalBodyBgColor = document.body.style.backgroundColor;

    // Initial text for horror link (HTML sets it, but JS can ensure)
    // updateHorrorLinkText(); 

    // Ensure initial state of colorMessage (HTML should have it as "open the Secret Menu")
    // If isSecretMenuOpen is false, colorMessage should show "open ..."
    // If it was somehow already open (e.g. page refresh with JS state preserved by browser), render controls
    /* Commenting out the problematic block referencing isSecretMenuOpen
    if (isSecretMenuOpen) {
        renderMainControlMessage();
    } else if (colorMessage && openSecretMenuLink) {
        // Ensure listener is attached if not opened yet. HTML provides initial text.
    }
    */

    // Start intermittent message display
    const startIntermittentMessage = () => {
        stopIntermittent(secretIntermittentShowInterval, secretMessageHideTimeout);
        // Only start if the message is currently hidden (i.e., user is not actively hovering/interacting)
        if (colorMessage && colorMessage.classList.contains('hidden')) {
            secretIntermittentShowInterval = setInterval(() => {
                // Double check it's still hidden before showing, to avoid conflict with hover
                if (colorMessage.classList.contains('hidden')) {
                    showColorMessage(true);
                }
            }, INTERMITTENT_SHOW_DELAY + INTERMITTENT_DURATION); // Wait full cycle before next potential show
            // Show the first one after initial delay
            setTimeout(() => {
                if (colorMessage.classList.contains('hidden')) {
                     showColorMessage(true);
                }
            }, INTERMITTENT_SHOW_DELAY);
        }
    };
    
    // Start the intermittent message display initially if panel is hidden
    /* Commenting out the problematic block referencing colorPopup 
    if (colorPopup && colorPopup.classList.contains('hidden')) {
        startIntermittentMessage();
    }
    */

    // --- Countdown Functions ---
    function startCountdown() {
        if (isCountdownActive || !countdownDisplayElement) return;
        isCountdownActive = true;
        isApocalypseSequenceActive = false; // Reset for new countdown
        currentCountdownValue = 10;
        
        countdownDisplayElement.style.display = 'flex'; // Ensure it's not display:none from initial HTML
        countdownDisplayElement.classList.add('countdown-display-visible');

        function updateNumber() {
            countdownDisplayElement.textContent = currentCountdownValue;
            if (currentCountdownValue > 0) {
                currentCountdownValue--;
            } else { 
                clearInterval(countdownIntervalId); 
                countdownIntervalId = null; 
                triggerApocalypse();
            }
        }
        updateNumber(); // Display the first number (10) immediately
        countdownIntervalId = setInterval(updateNumber, 1000);
    }

    function stopCountdown() {
        clearInterval(countdownIntervalId);
        countdownIntervalId = null;
        
        if (isApocalypseSequenceActive) {
            restoreNormalView(); // If apocalypse happened, restore fully
        } else if (countdownDisplayElement) { 
            countdownDisplayElement.classList.remove('countdown-display-visible');
            setTimeout(() => {
                if (!isCountdownActive && !isApocalypseSequenceActive) { 
                     countdownDisplayElement.textContent = '';
                }
            }, 300); 
        }
        isCountdownActive = false;
        // If nuke mode was active and is being stopped, ensure its visual effects are also reset.
        // This is somewhat implicitly handled by restoreNormalView or if another effect takes over.
        // However, to be certain, if nuke was the cause, its specific cleanup might be needed.
        // For now, toggleNukeMode sets isNukeActive = false before calling stopCountdown.
        // And if apocalypse happened, body BG is restored by restoreNormalView.
        // If only countdown (from nuke) is stopped before apocalypse, toggleNukeMode should handle BG.
    }

    function triggerApocalypse() {
        isApocalypseSequenceActive = true;

        if (nukeIntervalId) {
            clearInterval(nukeIntervalId);
            nukeIntervalId = null;
        }

        if (countdownDisplayElement) {
            countdownDisplayElement.classList.remove('countdown-display-visible');
            countdownDisplayElement.style.display = 'none'; 
            countdownDisplayElement.textContent = ''; 
        }

        if (apocalypseOverlay) {
            apocalypseOverlay.style.display = 'block';
        }

        // Wait 0.4 seconds, then show popup
        setTimeout(() => { // Show self-destruct popup
            if (isApocalypseSequenceActive && selfDestructPopup) { 
                selfDestructPopup.style.display = 'block'; // Explicitly set display
                selfDestructPopup.classList.add('visible'); 

                // After popup is visible, wait 0.4 seconds then start wiggling
                setTimeout(() => {
                    if (isApocalypseSequenceActive && selfDestructPopup) {
                        selfDestructPopup.classList.add('destruct-wiggle-active');

                        // After wiggling starts, wait 1.2 seconds then "close" the page
                        pageCloseTimeoutId = setTimeout(() => {
                            if (isApocalypseSequenceActive) { // Check again before navigating
                                window.location.href = 'about:blank';
                            }
                        }, 1200); // 1.2 seconds after wiggling starts
                    }
                }, 400); // 0.4 seconds delay for wiggling to start
            }
        }, 400); // Changed from 1500 to 400
    }

    function restoreNormalView() {
        clearTimeout(pageCloseTimeoutId); // Clear page close timeout

        if (apocalypseOverlay) {
            apocalypseOverlay.style.display = 'none';
        }

        if (siteHeader) siteHeader.style.display = ''; 
        if (iconGrid) iconGrid.style.display = ''; 

        document.body.style.backgroundColor = originalBodyBgColor || 'white';
        document.body.style.backgroundImage = originalBodyBgImage || '';
        document.body.style.transition = ''; 

        if (selfDestructPopup) {
            selfDestructPopup.classList.remove('visible');
            selfDestructPopup.classList.remove('destruct-wiggle-active'); // Remove wiggle class
            selfDestructPopup.style.display = 'none'; // Also explicitly hide
        }

        if (countdownDisplayElement) {
            countdownDisplayElement.classList.remove('countdown-display-visible');
             setTimeout(() => {
                if (!isCountdownActive && !isApocalypseSequenceActive) { 
                     countdownDisplayElement.textContent = '';
                }
            }, 300);
        }
        isApocalypseSequenceActive = false;
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
        artIconOriginalImage.crossOrigin = "anonymous";

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