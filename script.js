document.addEventListener('DOMContentLoaded', () => {
    const jkbxLink = document.getElementById('jkbx-link');
    const jkbxInfoBox = document.getElementById('jkbx-info-box');
    const blurOverlay = document.getElementById('blur-overlay'); // Get overlay element

    const redButtonLink = document.getElementById('red-button-link'); // New Red Button

    let leaveTimeout; // Variable to hold the timeout ID
    const leaveDelay = 300; // Delay in milliseconds before hiding

    if (jkbxLink && jkbxInfoBox) {
        jkbxLink.addEventListener('mouseenter', () => {
            clearTimeout(leaveTimeout); // Clear any pending hide actions

            // Calculate position for the info box
            const iconRect = jkbxLink.getBoundingClientRect(); // Get icon link position
            const infoBox = jkbxInfoBox; // Use a shorter name
            
            // Recalculate dimensions *after* making visible (or use estimates)
            infoBox.style.visibility = 'hidden'; // Keep hidden but allow measurement
            infoBox.style.display = 'block'; // Temporarily display to measure
            const infoBoxWidth = infoBox.offsetWidth;
            const infoBoxHeight = infoBox.offsetHeight;
            infoBox.style.display = ''; // Reset display
            infoBox.style.visibility = ''; // Reset visibility

            let top, left;
            const mobileBreakpoint = 768;
            const padding = 15; // Space between icon and info box

            if (window.innerWidth < mobileBreakpoint) {
                // Mobile: Position centered above the icon
                top = iconRect.top - infoBoxHeight - padding;
                left = iconRect.left + (iconRect.width / 2) - (infoBoxWidth / 2);
            } else {
                // Desktop: Position vertically centered to the right of the icon
                top = iconRect.top + (iconRect.height / 2) - (infoBoxHeight / 2);
                left = iconRect.right + (padding / 3); /* MODIFIED: Reduced padding for closer positioning */
            }

            // --- Boundary checks --- 
            if (top < padding) top = padding;
            if (left < padding) left = padding;
            if (left + infoBoxWidth > window.innerWidth - padding) {
                left = window.innerWidth - infoBoxWidth - padding;
            }
             if (top + infoBoxHeight > window.innerHeight - padding) {
                // Adjust if too low: could move it up, or reposition left/right on desktop
                top = window.innerHeight - infoBoxHeight - padding;
                // Optional: If it also goes off the right edge now, maybe position left?
                if (window.innerWidth >= mobileBreakpoint && left + infoBoxWidth > window.innerWidth - padding) {
                    left = iconRect.left - infoBoxWidth - padding;
                    if (left < padding) left = padding; // Check left boundary again
                }
            }
            // --- End boundary checks ---

            infoBox.style.top = `${top}px`;
            infoBox.style.left = `${left}px`;

            // Show info box (overlay logic removed)
            // blurOverlay.classList.add('visible');
            infoBox.classList.add('visible');
        });

        const hideElements = () => {
             leaveTimeout = setTimeout(() => {
                // blurOverlay.classList.remove('visible');
                jkbxInfoBox.classList.remove('visible');
            }, leaveDelay);
        }

        jkbxLink.addEventListener('mouseleave', hideElements);

        // Keep elements visible if mouse moves onto the info box
        jkbxInfoBox.addEventListener('mouseenter', () => {
            clearTimeout(leaveTimeout); // Cancel hiding if mouse enters the box itself
        });

        // Hide when mouse leaves the info box
        jkbxInfoBox.addEventListener('mouseleave', hideElements);
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


    // Initially hide messages - These elements are removed from HTML, so related JS is not needed.
    // if (colorMessage) colorMessage.classList.add('hidden');
    // if (horrorMessageBox) horrorMessageBox.classList.add('hidden');

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
    if (isSecretMenuOpen) {
        renderMainControlMessage();
    } else if (colorMessage && openSecretMenuLink) {
        // Ensure listener is attached if not opened yet. HTML provides initial text.
    }

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
    if (colorPopup && colorPopup.classList.contains('hidden')) {
        startIntermittentMessage();
    }

    if (toggleTumultuousModeButton) {
        const iconLinks = document.querySelectorAll('.icon-grid .icon-link');

        toggleTumultuousModeButton.addEventListener('click', () => {
            document.body.classList.toggle('tumultuous-mode-active');
            const isTumultuousActive = document.body.classList.contains('tumultuous-mode-active');

            if (isTumultuousActive) {
                toggleTumultuousModeButton.textContent = 'Disarm Nuke'; // New text
                iconLinks.forEach(icon => {
                    icon.style.animationName = 'tumultuous-float';
                    icon.style.animationDuration = (Math.random() * 0.4 + 0.3).toFixed(2) + 's';
                    icon.style.animationDelay = (Math.random() * 0.2).toFixed(2) + 's';
                    icon.style.animationTimingFunction = 'linear';
                    icon.style.animationIterationCount = 'infinite';
                    icon.style.animationDirection = 'normal';
                });

                // Start Nuke background flash
                if (nukeIntervalId === null) { // Prevent multiple intervals
                    originalBodyBgImage = document.body.style.backgroundImage;
                    originalBodyBgColor = document.body.style.backgroundColor;
                    nukeIntervalId = setInterval(() => {
                        const currentBgImage = document.body.style.backgroundImage;
                        const currentBgColor = document.body.style.backgroundColor;
                        
                        document.body.style.backgroundImage = '';
                        document.body.style.backgroundColor = 'red';
                        
                        setTimeout(() => {
                            // Only revert if still in nuke mode and not overridden by another color change
                            if (document.body.classList.contains('tumultuous-mode-active')) {
                                // If a random gradient was active, prioritize it.
                                // Otherwise, if a solid color was set before red flash, use it.
                                // Fallback to transparent if neither was set.
                                if (originalBodyBgImage) {
                                    document.body.style.backgroundImage = originalBodyBgImage;
                                    document.body.style.backgroundColor = ''; // Clear color to let image show
                                } else {
                                    document.body.style.backgroundImage = ''; // Ensure no lingering image
                                    document.body.style.backgroundColor = originalBodyBgColor || '';
                                }
                            }
                        }, 150); // Duration of the red flash
                    }, 1000); // Flash every 1 second
                }

            } else {
                toggleTumultuousModeButton.textContent = 'Nuke'; // New text
                iconLinks.forEach(icon => {
                    icon.style.animationName = '';
                    icon.style.animationDuration = '';
                    icon.style.animationDelay = '';
                    icon.style.animationTimingFunction = '';
                    icon.style.animationIterationCount = '';
                    icon.style.animationDirection = '';
                });

                // Stop Nuke background flash
                if (nukeIntervalId !== null) {
                    clearInterval(nukeIntervalId);
                    nukeIntervalId = null;
                    // Restore original background if it existed, otherwise clear red
                    document.body.style.backgroundImage = originalBodyBgImage;
                    document.body.style.backgroundColor = originalBodyBgColor;
                    originalBodyBgImage = ''; // Clear stored values
                    originalBodyBgColor = '';
                }
            }
        });
    }

    // --- Countdown Functions ---
    function startCountdown() {
        if (isCountdownActive || !countdownDisplayElement) return;
        isCountdownActive = true;
        currentCountdownValue = 10;
        
        countdownDisplayElement.style.display = 'flex'; // Ensure it's not display:none from initial HTML
        countdownDisplayElement.classList.add('countdown-display-visible');

        function updateNumber() {
            if (currentCountdownValue >= 1) {
                countdownDisplayElement.textContent = currentCountdownValue;
                currentCountdownValue--;
            } else {
                stopCountdown(); // Automatically stops after 1 has been displayed
            }
        }
        updateNumber(); // Display the first number (10) immediately
        countdownIntervalId = setInterval(updateNumber, 1000);
    }

    function stopCountdown() {
        clearInterval(countdownIntervalId);
        countdownIntervalId = null;
        if (countdownDisplayElement) {
            countdownDisplayElement.classList.remove('countdown-display-visible');
            // Optional: delay hiding with display:none to allow fade-out transition to complete
            setTimeout(() => {
                if (!isCountdownActive) { // Check again in case it was restarted quickly
                     countdownDisplayElement.textContent = ''; // Clear text after fade
                     // countdownDisplayElement.style.display = 'none'; // Hide it fully if needed after transition
                }
            }, 300); // Match CSS transition duration
        }
        isCountdownActive = false;
    }

}); 