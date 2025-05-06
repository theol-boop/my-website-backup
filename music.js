document.addEventListener('DOMContentLoaded', () => {
    const navItems = document.querySelectorAll('.music-nav .nav-item');
    const contentSections = document.querySelectorAll('.music-content .content-section');

    navItems.forEach(item => {
        item.addEventListener('click', (event) => {
            event.preventDefault(); // Prevent default anchor jump

            // Get the target section ID from href
            const targetId = item.getAttribute('href').substring(1); // Remove the #
            const targetSection = document.getElementById(targetId);

            // If target section doesn't exist, do nothing
            if (!targetSection) return;

            // Remove active class from all nav items and sections
            navItems.forEach(nav => nav.classList.remove('active'));
            contentSections.forEach(section => section.classList.remove('active-section'));

            // Add active class to the clicked nav item
            item.classList.add('active');

            // Add active-section class to the target content section
            targetSection.classList.add('active-section');
        });
    });
}); 