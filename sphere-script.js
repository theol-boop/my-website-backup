// Basic Three.js scene setup
let scene, camera, renderer;
let sphere, material;
let gifCanvas; // Offscreen canvas for gifler

const gifPath = 'images/jp-animated-logo-transparent.gif'; // Path to your GIF

function init() {
    // Scene
    scene = new THREE.Scene();

    // Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0); // Transparent background for renderer
    document.body.appendChild(renderer.domElement);

    // Offscreen canvas for gifler
    gifCanvas = document.createElement('canvas');
    // Let gifler set the canvas size based on the GIF dimensions
    // No need to add gifCanvas to the DOM

    // Texture from the offscreen canvas
    const texture = new THREE.CanvasTexture(gifCanvas);
    texture.premultiplyAlpha = true; // Important for transparent GIFs

    // Material
    // Using MeshBasicMaterial for simplicity, supports transparency with alphaMap or transparent: true + texture alpha
    material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        alphaTest: 0.1, // Adjust if transparency isn't quite right
        side: THREE.DoubleSide // Render both sides, useful for open/transparent parts
    });

    // Geometry
    const geometry = new THREE.SphereGeometry(2, 64, 64); // Radius, widthSegments, heightSegments

    // Sphere Mesh
    sphere = new THREE.Mesh(geometry, material);
    scene.add(sphere);
    
    // Lighting (optional for MeshBasicMaterial, but good for future MeshStandardMaterial)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const pointLight = new THREE.PointLight(0xffffff, 0.8);
    camera.add(pointLight); // Attach light to camera
    scene.add(camera);


    // Load and play GIF using gifler
    // gifler function is globally available if the script is loaded
    window.gifler(gifPath).frames(gifCanvas, function (ctx, frame) {
        // This callback is called for each frame AFTER gifler has drawn it to gifCanvas.
        
        // Ensure canvas dimensions are set based on the first frame if not already.
        // gifler might handle this, but it's good to be sure for the CanvasTexture.
        if (gifCanvas.width !== frame.width || gifCanvas.height !== frame.height) {
            gifCanvas.width = frame.width;
            gifCanvas.height = frame.height;
            // Texture dimensions might need an update if canvas size changes after first texture creation.
            // However, CanvasTexture should adapt.
        }
        
        // The crucial part: tell Three.js that the texture source (gifCanvas) has changed.
        if (material && material.map) {
            material.map.needsUpdate = true;
        }
    });
    
    // Handle window resize
    window.addEventListener('resize', onWindowResize, false);

    animate();
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);

    // Optional: Rotate the sphere
    if (sphere) {
        sphere.rotation.x += 0.001;
        sphere.rotation.y += 0.002;
    }

    renderer.render(scene, camera);
}

// Check if Three.js and gifler are loaded before initializing
if (typeof THREE !== 'undefined' && typeof gifler !== 'undefined') {
    init();
} else {
    console.error('Three.js or Gifler library not loaded.');
    // You might want to add a fallback message to the user on the page itself
    document.body.innerHTML = '<p>Error: Could not load 3D libraries. Please check the console.</p>';
} 