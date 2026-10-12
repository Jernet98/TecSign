    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');

    let menuOpen = false;

    menuToggle.addEventListener('click', () => {
      sidebar.classList.toggle('active');
      menuOpen = !menuOpen;
    });
