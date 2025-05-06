document.addEventListener('DOMContentLoaded', () => {
    const galleryItems = document.querySelectorAll('.art-item');
    const body = document.body;

    galleryItems.forEach(item => {
        const preview = item.querySelector('.preview');
        const fullImageContainer = item.querySelector('.full-image-container');

        // Function to open the item
        const openItem = () => {
            if (body.classList.contains('gallery-active')) return; // Don't open if another is already open

            item.classList.add('expanded');
            body.classList.add('gallery-active');
            item.focus(); // Keep focus on the item
        };

        // Function to close the item
        const closeItem = () => {
            item.classList.remove('expanded');
            body.classList.remove('gallery-active');
            preview.focus(); // Return focus to the preview
        };

        // --- Event Listeners --- 

        // Click on preview to open
        preview.addEventListener('click', openItem);
        // Also allow Enter key on focused item itself to open (Accessibility)
        item.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && document.activeElement === item) { 
                openItem();
            }
        });

        // Click on full image container overlay to close
        fullImageContainer.addEventListener('click', closeItem);

        // Allow Escape key to close the expanded image
        item.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && item.classList.contains('expanded')) {
                closeItem();
            }
        });

    });

    console.log(`Art gallery script loaded and ${galleryItems.length} items initialized.`);
}); 