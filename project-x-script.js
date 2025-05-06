// Get the canvas element
const canvas = document.getElementById('gradient-canvas');

// Basic Three.js setup
const scene = new THREE.Scene();
// Add a background color to the scene for debugging
scene.background = new THREE.Color(0x222222); // Dark grey background

// Get initial dimensions (add logging)
let initialWidth = canvas.clientWidth;
let initialHeight = canvas.clientHeight;
console.log(`Initial Canvas Dimensions: ${initialWidth} x ${initialHeight}`);

// If dimensions are 0 initially, use fallback or wait?
// For now, let's proceed but be aware.
if (initialWidth === 0 || initialHeight === 0) {
    console.warn("Canvas dimensions are initially zero. Check CSS loading/styles.");
    // Provide some fallback dimensions to avoid NaN issues, though layout might be wrong
    initialWidth = initialWidth || 500; // Use CSS default width
    initialHeight = initialHeight || 300; // Use CSS default height
}

const camera = new THREE.PerspectiveCamera(75, initialWidth / initialHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas: canvas });
renderer.setPixelRatio(window.devicePixelRatio);

// ... existing shader code ...

const gradientMaterial = new THREE.ShaderMaterial({
    vertexShader: vertexShader,
    fragmentShader: fragmentShader,
    uniforms: {
        colorA: { value: new THREE.Color(0xff0000) }, // Red
        colorB: { value: new THREE.Color(0x0000ff) }  // Blue
    },
    side: THREE.DoubleSide
});

const plane = new THREE.Mesh(geometry, gradientMaterial);
scene.add(plane);

// Position camera
camera.position.z = 5;

// Animation loop
function animate() {
    requestAnimationFrame(animate);

    // Add any animations or updates here later

    renderer.render(scene, camera);
}

// Handle resize (also used for initial setup)
function onWindowResize() {
    const currentWidth = canvas.clientWidth;
    const currentHeight = canvas.clientHeight;
    console.log(`Resizing/Initializing to: ${currentWidth} x ${currentHeight}`);

    // Update camera aspect ratio
    camera.aspect = currentWidth / currentHeight;
    camera.updateProjectionMatrix();

    // Update renderer size
    renderer.setSize(currentWidth, currentHeight);
}

window.addEventListener('resize', onWindowResize, false);

// Initial setup call for size
onWindowResize();

animate();

// ... rest of the code (raycasting, etc) ...